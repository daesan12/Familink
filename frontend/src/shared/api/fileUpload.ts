import RNFS from 'react-native-fs';

import {BlobUploadError} from './blobUpload';

export interface NativeFileUploadOptions {
  contentType: string;
  fileName: string;
  headers: Readonly<Record<string, string>>;
  onProgress?: (progress: {loaded: number; total?: number}) => void;
  signal?: AbortSignal;
}

export async function uploadFileWithRnfs(
  uploadUrl: string,
  uri: string,
  options: NativeFileUploadOptions,
): Promise<void> {
  const filepath = toLocalFilePath(uri);
  if (filepath === null) {
    throw new BlobUploadError('Native upload requires a local file');
  }

  const task = RNFS.uploadFiles({
    binaryStreamOnly: true,
    files: [
      {
        filename: options.fileName,
        filepath,
        filetype: options.contentType,
        name: 'file',
      },
    ],
    headers: {...options.headers},
    method: 'PUT',
    progress: event => {
      options.onProgress?.({
        loaded: event.totalBytesSent,
        total: event.totalBytesExpectedToSend,
      });
    },
    toUrl: uploadUrl,
  });

  const abortUpload = () => RNFS.stopUpload(task.jobId);
  options.signal?.addEventListener('abort', abortUpload, {once: true});
  if (options.signal?.aborted) {
    abortUpload();
    options.signal?.removeEventListener('abort', abortUpload);
    throw new BlobUploadError('S3 upload aborted');
  }

  try {
    const result = await task.promise;
    if (result.statusCode < 200 || result.statusCode >= 300) {
      throw new BlobUploadError(
        `S3 upload failed with HTTP ${result.statusCode}`,
        result.statusCode,
      );
    }
  } catch (error) {
    if (options.signal?.aborted) {
      throw new BlobUploadError('S3 upload aborted');
    }
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', abortUpload);
  }
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
