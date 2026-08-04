import {
  createVideoThumbnail,
  Image as CompressorImage,
} from 'react-native-compressor';
import RNFS from 'react-native-fs';

export interface MediaSource {
  contentType?: string;
  fileName?: string;
  kind: 'image' | 'video';
  uri: string;
}

export interface ProcessedMediaAsset {
  contentType: string;
  fileName: string;
  sizeBytes?: number;
  temporaryUris?: readonly string[];
  uri: string;
}

interface LocalFileStat {
  size: unknown;
}

export interface ClientMediaProcessor {
  clearTemporaryFiles?(assets: readonly ProcessedMediaAsset[]): Promise<void>;
  preparePostOriginal(source: MediaSource): Promise<ProcessedMediaAsset>;
  preparePostThumbnail(source: MediaSource): Promise<ProcessedMediaAsset>;
  prepareProfileImage(source: MediaSource): Promise<ProcessedMediaAsset>;
}

const JPEG_CONTENT_TYPE = 'image/jpeg';

export const clientMediaProcessor: ClientMediaProcessor = {
  async clearTemporaryFiles(assets) {
    const temporaryUris = [
      ...new Set(assets.flatMap(asset => asset.temporaryUris ?? [])),
    ];
    await Promise.all(temporaryUris.map(deleteTemporaryFile));
  },

  async preparePostOriginal(source) {
    if (source.kind === 'video') {
      const stat = await statLocalFile(source.uri);
      return {
        contentType: source.contentType ?? 'video/mp4',
        fileName: source.fileName ?? 'post-video.mp4',
        sizeBytes: normalizeFileSize(stat.size),
        temporaryUris: [],
        uri: source.uri,
      };
    }

    return compressImage(source.uri, source.fileName, {
      fallbackName: 'post-image.jpg',
      maxSize: 2048,
      quality: 0.82,
    });
  },

  async preparePostThumbnail(source) {
    const videoThumbnail =
      source.kind === 'video'
        ? await createVideoThumbnail(source.uri, {quality: 0.8})
        : undefined;
    const thumbnailSource = videoThumbnail?.path ?? source.uri;
    try {
      const thumbnail = await compressImage(thumbnailSource, source.fileName, {
        fallbackName: 'post-thumbnail.jpg',
        maxSize: 1280,
        quality: 0.82,
        suffix: '-thumbnail',
      });
      return {
        ...thumbnail,
        temporaryUris: [
          ...(videoThumbnail === undefined ? [] : [videoThumbnail.path]),
          ...(thumbnail.temporaryUris ?? []),
        ],
      };
    } catch (error) {
      if (videoThumbnail !== undefined) {
        await deleteTemporaryFile(videoThumbnail.path).catch(() => undefined);
      }
      throw error;
    }
  },

  async prepareProfileImage(source) {
    return compressImage(source.uri, source.fileName, {
      fallbackName: 'profile-image.jpg',
      maxSize: 1024,
      quality: 0.8,
    });
  },
};

async function compressImage(
  uri: string,
  fileName: string | undefined,
  options: {
    fallbackName: string;
    maxSize: number;
    quality: number;
    suffix?: string;
  },
): Promise<ProcessedMediaAsset> {
  const compressedUri = await CompressorImage.compress(uri, {
    compressionMethod: 'manual',
    maxHeight: options.maxSize,
    maxWidth: options.maxSize,
    output: 'jpg',
    quality: options.quality,
    returnableOutputType: 'uri',
  });
  const stat = await statLocalFile(compressedUri);

  return {
    contentType: JPEG_CONTENT_TYPE,
    fileName: toJpegFileName(fileName, options.fallbackName, options.suffix),
    sizeBytes: normalizeFileSize(stat.size),
    temporaryUris: [compressedUri],
    uri: compressedUri,
  };
}

async function statLocalFile(uri: string): Promise<LocalFileStat> {
  const path = toLocalFilePath(uri);
  if (path === null) {
    throw new Error('Media processing requires a local file');
  }
  return RNFS.stat(path);
}

function normalizeFileSize(value: unknown): number {
  const size = typeof value === 'string' ? Number(value) : value;
  if (
    typeof size !== 'number' ||
    !Number.isSafeInteger(size) ||
    size <= 0
  ) {
    throw new Error('Media file size is unavailable');
  }
  return size;
}

async function deleteTemporaryFile(uri: string): Promise<void> {
  const path = toLocalFilePath(uri);
  if (path === null || !(await RNFS.exists(path))) {
    return;
  }
  await RNFS.unlink(path);
}

function toLocalFilePath(uri: string): string | null {
  let path: string;
  if (uri.startsWith('file:')) {
    path = uri.slice('file:'.length).replace(/^\/+/, '/');
  } else if (uri.startsWith('/')) {
    path = uri;
  } else {
    return null;
  }
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
}

function toJpegFileName(
  fileName: string | undefined,
  fallbackName: string,
  suffix = '',
): string {
  const normalized = fileName?.trim();
  if (!normalized) {
    return fallbackName;
  }
  const lastDot = normalized.lastIndexOf('.');
  const baseName = lastDot > 0 ? normalized.slice(0, lastDot) : normalized;
  return `${baseName}${suffix}.jpg`;
}
