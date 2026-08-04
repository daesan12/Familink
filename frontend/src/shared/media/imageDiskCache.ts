import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

const CACHE_INDEX_KEY = '@familink/image-disk-cache/v1';
const CACHE_VERSION = 1;
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  createdAt: number;
  fileName: string;
  lastAccessAt: number;
  size: number;
}

interface CacheIndex {
  entries: Record<string, CacheEntry>;
  version: typeof CACHE_VERSION;
}

export interface ImageDiskCache {
  clearAll(): Promise<void>;
  remove(remoteUrl: string): Promise<void>;
  resolve(remoteUrl: string): Promise<string>;
}

export interface ImageCacheFileSystem {
  CachesDirectoryPath: string;
  downloadFile(options: {fromUrl: string; toFile: string}): {
    promise: Promise<{statusCode: number}>;
  };
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
  moveFile(from: string, to: string): Promise<void>;
  stat(path: string): Promise<{size: number | string}>;
  unlink(path: string): Promise<void>;
}

export interface ImageCacheStorage {
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  setItem(key: string, value: string): Promise<void>;
}

interface ImageDiskCacheOptions {
  fileSystem?: ImageCacheFileSystem;
  maxBytes?: number;
  now?: () => number;
  random?: () => number;
  storage?: ImageCacheStorage;
  ttlMs?: number;
}

function emptyIndex(): CacheIndex {
  return {entries: {}, version: CACHE_VERSION};
}

export function stableImageCacheKey(remoteUrl: string): string {
  const parsed = new URL(remoteUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP(S) images can be cached.');
  }
  return `${parsed.host}${parsed.pathname}`;
}

function isCacheEntry(value: unknown): value is CacheEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const entry = value as Partial<CacheEntry>;
  return (
    typeof entry.createdAt === 'number' &&
    typeof entry.fileName === 'string' &&
    typeof entry.lastAccessAt === 'number' &&
    typeof entry.size === 'number' &&
    entry.size >= 0
  );
}

function parseIndex(raw: string | null): CacheIndex {
  if (raw === null) {
    return emptyIndex();
  }
  const parsed = JSON.parse(raw) as Partial<CacheIndex>;
  if (
    parsed.version !== CACHE_VERSION ||
    typeof parsed.entries !== 'object' ||
    parsed.entries === null ||
    Object.values(parsed.entries).some(entry => !isCacheEntry(entry))
  ) {
    throw new Error('Invalid image cache index.');
  }
  return parsed as CacheIndex;
}

export function createImageDiskCache({
  fileSystem = RNFS as ImageCacheFileSystem,
  maxBytes = DEFAULT_MAX_BYTES,
  now = Date.now,
  random = Math.random,
  storage = AsyncStorage,
  ttlMs = DEFAULT_TTL_MS,
}: ImageDiskCacheOptions = {}): ImageDiskCache {
  const cacheDirectory = `${fileSystem.CachesDirectoryPath}/familink-images`;
  const inFlight = new Map<string, Promise<string>>();
  let mutationQueue = Promise.resolve();
  let generation = 0;

  const withMutationLock = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = mutationQueue.then(operation, operation);
    mutationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  const ensureDirectory = async () => {
    if (!(await fileSystem.exists(cacheDirectory))) {
      await fileSystem.mkdir(cacheDirectory);
    }
  };

  const clearDirectory = async () => {
    if (await fileSystem.exists(cacheDirectory)) {
      await fileSystem.unlink(cacheDirectory);
    }
    await fileSystem.mkdir(cacheDirectory);
  };

  const loadIndex = async (): Promise<CacheIndex> => {
    try {
      return parseIndex(await storage.getItem(CACHE_INDEX_KEY));
    } catch {
      await clearDirectory();
      const index = emptyIndex();
      await storage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));
      return index;
    }
  };

  const saveIndex = (index: CacheIndex) =>
    storage.setItem(CACHE_INDEX_KEY, JSON.stringify(index));

  const removeEntryFile = async (entry: CacheEntry) => {
    const path = `${cacheDirectory}/${entry.fileName}`;
    if (await fileSystem.exists(path)) {
      await fileSystem.unlink(path);
    }
  };

  const prune = async (index: CacheIndex, currentTime: number) => {
    const entries = Object.entries(index.entries);
    for (const [key, entry] of entries) {
      if (currentTime - entry.createdAt > ttlMs) {
        await removeEntryFile(entry);
        delete index.entries[key];
      }
    }

    let totalSize = Object.values(index.entries).reduce(
      (sum, entry) => sum + entry.size,
      0,
    );
    if (totalSize <= maxBytes) {
      return;
    }
    const oldestFirst = Object.entries(index.entries).sort(
      ([, left], [, right]) => left.lastAccessAt - right.lastAccessAt,
    );
    for (const [key, entry] of oldestFirst) {
      if (totalSize <= maxBytes) {
        break;
      }
      await removeEntryFile(entry);
      delete index.entries[key];
      totalSize -= entry.size;
    }
  };

  const findCachedPath = (key: string) =>
    withMutationLock(async () => {
      await ensureDirectory();
      const index = await loadIndex();
      await prune(index, now());
      const entry = index.entries[key];
      if (entry === undefined) {
        await saveIndex(index);
        return null;
      }
      const path = `${cacheDirectory}/${entry.fileName}`;
      if (!(await fileSystem.exists(path))) {
        delete index.entries[key];
        await saveIndex(index);
        return null;
      }
      entry.lastAccessAt = now();
      await saveIndex(index);
      return `file://${path}`;
    });

  const download = async (remoteUrl: string, key: string) => {
    const downloadGeneration = generation;
    await ensureDirectory();
    const token = `${now()}-${Math.floor(random() * 1_000_000_000)}`;
    const tempPath = `${cacheDirectory}/.${token}.tmp`;
    const fileName = `${token}.image`;
    const finalPath = `${cacheDirectory}/${fileName}`;
    try {
      const result = await fileSystem.downloadFile({
        fromUrl: remoteUrl,
        toFile: tempPath,
      }).promise;
      if (result.statusCode < 200 || result.statusCode >= 300) {
        throw new Error(`Image download failed with ${result.statusCode}.`);
      }
      const fileStat = await fileSystem.stat(tempPath);
      const size = Number(fileStat.size);
      if (!Number.isFinite(size) || size <= 0) {
        throw new Error('Downloaded image is empty.');
      }
      await withMutationLock(async () => {
        if (downloadGeneration !== generation) {
          throw new Error('Image cache was cleared during download.');
        }
        await fileSystem.moveFile(tempPath, finalPath);
        const index = await loadIndex();
        const previous = index.entries[key];
        if (previous !== undefined) {
          await removeEntryFile(previous);
        }
        const currentTime = now();
        index.entries[key] = {
          createdAt: currentTime,
          fileName,
          lastAccessAt: currentTime,
          size,
        };
        await prune(index, currentTime);
        await saveIndex(index);
      });
      return `file://${finalPath}`;
    } catch (error) {
      if (await fileSystem.exists(tempPath)) {
        await fileSystem.unlink(tempPath);
      }
      if (await fileSystem.exists(finalPath)) {
        await fileSystem.unlink(finalPath);
      }
      throw error;
    }
  };

  return {
    async clearAll() {
      generation += 1;
      await withMutationLock(async () => {
        let failure: unknown;
        try {
          await storage.removeItem(CACHE_INDEX_KEY);
        } catch (error) {
          failure = error;
        }
        try {
          await clearDirectory();
        } catch (error) {
          failure ??= error;
        }
        if (failure !== undefined) {
          throw failure;
        }
      });
    },

    async remove(remoteUrl) {
      const key = stableImageCacheKey(remoteUrl);
      await withMutationLock(async () => {
        const index = await loadIndex();
        const entry = index.entries[key];
        if (entry !== undefined) {
          await removeEntryFile(entry);
          delete index.entries[key];
          await saveIndex(index);
        }
      });
    },

    async resolve(remoteUrl) {
      const key = stableImageCacheKey(remoteUrl);
      const existing = inFlight.get(key);
      if (existing !== undefined) {
        return existing;
      }
      const operation = (async () => {
        const cachedPath = await findCachedPath(key);
        return cachedPath ?? download(remoteUrl, key);
      })();
      inFlight.set(key, operation);
      try {
        return await operation;
      } finally {
        inFlight.delete(key);
      }
    },
  };
}

export const imageDiskCache = createImageDiskCache();
