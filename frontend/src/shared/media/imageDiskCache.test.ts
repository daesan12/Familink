import {
  createImageDiskCache,
  stableImageCacheKey,
  type ImageCacheFileSystem,
  type ImageCacheStorage,
} from './imageDiskCache';

function createStorage(): ImageCacheStorage {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn(key => Promise.resolve(values.get(key) ?? null)),
    removeItem: jest.fn(key => {
      values.delete(key);
      return Promise.resolve();
    }),
    setItem: jest.fn((key, value) => {
      values.set(key, value);
      return Promise.resolve();
    }),
  };
}

function createFileSystem() {
  const files = new Map<string, number>();
  files.set('/cache/familink-images', 0);
  const fileSystem: ImageCacheFileSystem = {
    CachesDirectoryPath: '/cache',
    downloadFile: jest.fn(({toFile}) => ({
      promise: Promise.resolve().then(() => {
        files.set(toFile, 10);
        return {statusCode: 200};
      }),
    })),
    exists: jest.fn(path => Promise.resolve(files.has(path))),
    mkdir: jest.fn(path => {
      files.set(path, 0);
      return Promise.resolve();
    }),
    moveFile: jest.fn((from, to) => {
      const size = files.get(from);
      if (size === undefined) {
        return Promise.reject(new Error('missing source'));
      }
      files.delete(from);
      files.set(to, size);
      return Promise.resolve();
    }),
    stat: jest.fn(path => Promise.resolve({size: files.get(path) ?? 0})),
    unlink: jest.fn(path => {
      for (const filePath of [...files.keys()]) {
        if (filePath === path || filePath.startsWith(`${path}/`)) {
          files.delete(filePath);
        }
      }
      return Promise.resolve();
    }),
  };
  return {fileSystem, files};
}

describe('imageDiskCache', () => {
  it('서명 query가 달라도 같은 S3 객체 키를 사용한다', () => {
    expect(
      stableImageCacheKey('https://bucket.s3.amazonaws.com/profile-image/a.jpg?signature=one'),
    ).toBe(
      stableImageCacheKey('https://bucket.s3.amazonaws.com/profile-image/a.jpg?signature=two#hash'),
    );
  });

  it('캐시 미스는 한 번 다운로드하고 이후 file 경로를 재사용한다', async () => {
    const {fileSystem} = createFileSystem();
    const cache = createImageDiskCache({
      fileSystem,
      random: () => 0.1,
      storage: createStorage(),
    });
    const first = await cache.resolve('https://cdn/profile-image/a.jpg?x=1');
    const second = await cache.resolve('https://cdn/profile-image/a.jpg?x=2');

    expect(first).toBe(second);
    expect(fileSystem.downloadFile).toHaveBeenCalledTimes(1);
  });

  it('같은 이미지의 동시 요청을 하나의 다운로드로 합친다', async () => {
    const {fileSystem} = createFileSystem();
    const cache = createImageDiskCache({
      fileSystem,
      random: () => 0.2,
      storage: createStorage(),
    });

    const [first, second] = await Promise.all([
      cache.resolve('https://cdn/post-media/a.jpg?x=1'),
      cache.resolve('https://cdn/post-media/a.jpg?x=2'),
    ]);

    expect(first).toBe(second);
    expect(fileSystem.downloadFile).toHaveBeenCalledTimes(1);
  });

  it('만료된 파일은 삭제하고 다시 다운로드한다', async () => {
    const {fileSystem} = createFileSystem();
    let currentTime = 1_000;
    const cache = createImageDiskCache({
      fileSystem,
      now: () => currentTime,
      random: () => currentTime / 10_000,
      storage: createStorage(),
      ttlMs: 100,
    });
    await cache.resolve('https://cdn/profile-image/a.jpg');
    currentTime = 1_101;
    await cache.resolve('https://cdn/profile-image/a.jpg');

    expect(fileSystem.downloadFile).toHaveBeenCalledTimes(2);
  });

  it('용량 제한을 넘으면 가장 오래 사용하지 않은 파일부터 제거한다', async () => {
    const {fileSystem} = createFileSystem();
    let currentTime = 1_000;
    const cache = createImageDiskCache({
      fileSystem,
      maxBytes: 15,
      now: () => currentTime,
      random: () => currentTime / 10_000,
      storage: createStorage(),
    });
    await cache.resolve('https://cdn/profile-image/old.jpg');
    currentTime += 1;
    await cache.resolve('https://cdn/profile-image/new.jpg');
    currentTime += 1;
    await cache.resolve('https://cdn/profile-image/old.jpg');

    expect(fileSystem.downloadFile).toHaveBeenCalledTimes(3);
  });

  it('실패한 다운로드 임시 파일은 캐시에 남기지 않는다', async () => {
    const {fileSystem, files} = createFileSystem();
    jest.mocked(fileSystem.downloadFile).mockImplementationOnce(({toFile}) => {
      files.set(toFile, 10);
      return {promise: Promise.resolve({statusCode: 403})};
    });
    const cache = createImageDiskCache({fileSystem, storage: createStorage()});

    await expect(cache.resolve('https://cdn/profile-image/a.jpg')).rejects.toThrow();

    expect([...files.keys()].some(path => path.endsWith('.tmp'))).toBe(false);
  });

  it('clearAll은 인덱스와 캐시 디렉터리를 함께 정리한다', async () => {
    const storage = createStorage();
    const {fileSystem, files} = createFileSystem();
    const cache = createImageDiskCache({fileSystem, storage});
    await cache.resolve('https://cdn/profile-image/a.jpg');

    await cache.clearAll();

    expect(storage.removeItem).toHaveBeenCalled();
    expect([...files.keys()]).toEqual(['/cache/familink-images']);
  });

  it('캐시 파일 삭제가 실패해도 계정 격리를 위해 인덱스는 제거한다', async () => {
    const storage = createStorage();
    const {fileSystem} = createFileSystem();
    const cache = createImageDiskCache({fileSystem, storage});
    await cache.resolve('https://cdn/profile-image/a.jpg');
    jest.mocked(fileSystem.unlink).mockRejectedValueOnce(new Error('disk failure'));

    await expect(cache.clearAll()).rejects.toThrow('disk failure');

    expect(storage.removeItem).toHaveBeenCalled();
  });

  it('다운로드 중 clearAll이 호출되면 완료된 파일을 캐시에 다시 넣지 않는다', async () => {
    const storage = createStorage();
    const {fileSystem, files} = createFileSystem();
    let finishDownload: (() => void) | undefined;
    let notifyDownloadStarted: (() => void) | undefined;
    const downloadStarted = new Promise<void>(resolve => {
      notifyDownloadStarted = resolve;
    });
    jest.mocked(fileSystem.downloadFile).mockImplementationOnce(({toFile}) => ({
      promise: new Promise(resolve => {
        notifyDownloadStarted?.();
        finishDownload = () => {
          files.set(toFile, 10);
          resolve({statusCode: 200});
        };
      }),
    }));
    const cache = createImageDiskCache({fileSystem, storage});

    const resolving = cache.resolve('https://cdn/profile-image/a.jpg');
    await downloadStarted;
    await cache.clearAll();
    finishDownload?.();

    await expect(resolving).rejects.toThrow('cleared during download');
    expect([...files.keys()]).toEqual(['/cache/familink-images']);
  });
});
