export interface BlobUploadProgress {
  loaded: number;
  total?: number;
}

export interface BlobUploadOptions {
  headers: Readonly<Record<string, string>>;
  onProgress?: (progress: BlobUploadProgress) => void;
  signal?: AbortSignal;
}

export class BlobUploadError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'BlobUploadError';
    this.status = status;
  }
}

export function uploadBlobWithXhr(
  uploadUrl: string,
  blob: Blob,
  options: BlobUploadOptions,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      options.signal?.removeEventListener('abort', abortUpload);
      callback();
    };
    const abortUpload = () => {
      xhr.abort();
      finish(() => reject(new BlobUploadError('S3 upload aborted')));
    };

    xhr.open('PUT', uploadUrl);
    for (const [name, value] of Object.entries(options.headers)) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = event => {
      options.onProgress?.({
        loaded: event.loaded,
        ...(event.lengthComputable ? {total: event.total} : {}),
      });
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        finish(resolve);
        return;
      }
      finish(() =>
        reject(
          new BlobUploadError(
            `S3 upload failed with HTTP ${xhr.status}`,
            xhr.status,
          ),
        ),
      );
    };
    xhr.onerror = () =>
      finish(() => reject(new BlobUploadError('S3 upload network error')));
    xhr.onabort = () =>
      finish(() => reject(new BlobUploadError('S3 upload aborted')));

    options.signal?.addEventListener('abort', abortUpload, {once: true});
    if (options.signal?.aborted) {
      abortUpload();
      return;
    }

    // React Native의 네이티브 XHR가 Blob 저장소를 직접 읽어 실제 파일 바이트를 전송한다.
    xhr.send(blob);
  });
}
