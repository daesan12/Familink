import {BlobUploadError, uploadBlobWithXhr} from './blobUpload';

class FakeXMLHttpRequest {
  static lastInstance: FakeXMLHttpRequest | null = null;

  readonly abort = jest.fn();
  readonly open = jest.fn();
  readonly send = jest.fn();
  readonly setRequestHeader = jest.fn();
  readonly upload = {
    onprogress: null as ((event: ProgressEvent) => void) | null,
  };
  onabort: ((event: ProgressEvent) => void) | null = null;
  onerror: ((event: ProgressEvent) => void) | null = null;
  onload: ((event: ProgressEvent) => void) | null = null;
  status = 0;

  constructor() {
    FakeXMLHttpRequest.lastInstance = this;
  }
}

describe('uploadBlobWithXhr', () => {
  const originalXMLHttpRequest = globalThis.XMLHttpRequest;

  beforeEach(() => {
    FakeXMLHttpRequest.lastInstance = null;
    Object.defineProperty(globalThis, 'XMLHttpRequest', {
      configurable: true,
      value: FakeXMLHttpRequest,
    });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'XMLHttpRequest', {
      configurable: true,
      value: originalXMLHttpRequest,
    });
  });

  it('sends the exact Blob through native XHR without JSON serialization', async () => {
    const blob = {size: 4096} as Blob;
    const promise = uploadBlobWithXhr('https://s3.example.com/upload', blob, {
      headers: {'Content-Type': 'image/jpeg'},
    });
    const xhr = requireLastXhr();

    expect(xhr.open).toHaveBeenCalledWith(
      'PUT',
      'https://s3.example.com/upload',
    );
    expect(xhr.setRequestHeader).toHaveBeenCalledWith(
      'Content-Type',
      'image/jpeg',
    );
    expect(xhr.send).toHaveBeenCalledWith(blob);

    xhr.status = 200;
    xhr.onload?.({} as ProgressEvent);
    await expect(promise).resolves.toBeUndefined();
  });

  it('reports an S3 HTTP failure with its status', async () => {
    const promise = uploadBlobWithXhr(
      'https://s3.example.com/upload',
      {size: 4096} as Blob,
      {headers: {'Content-Type': 'image/jpeg'}},
    );
    const xhr = requireLastXhr();

    xhr.status = 403;
    xhr.onload?.({} as ProgressEvent);

    await expect(promise).rejects.toMatchObject<Partial<BlobUploadError>>({
      name: 'BlobUploadError',
      status: 403,
    });
  });

  it('rejects immediately when the upload signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const promise = uploadBlobWithXhr(
      'https://s3.example.com/upload',
      {size: 4096} as Blob,
      {
        headers: {'Content-Type': 'image/jpeg'},
        signal: controller.signal,
      },
    );
    const xhr = requireLastXhr();

    expect(xhr.abort).toHaveBeenCalledTimes(1);
    expect(xhr.send).not.toHaveBeenCalled();
    await expect(promise).rejects.toMatchObject<Partial<BlobUploadError>>({
      message: 'S3 upload aborted',
      name: 'BlobUploadError',
    });
  });
});

function requireLastXhr(): FakeXMLHttpRequest {
  const xhr = FakeXMLHttpRequest.lastInstance;
  if (xhr === null) {
    throw new Error('XMLHttpRequest was not created');
  }
  return xhr;
}
