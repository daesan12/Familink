/* eslint-env jest */

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    API_BASE_URL: 'http://10.0.2.2:8080',
  },
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  getString: jest.fn().mockResolvedValue(''),
  setString: jest.fn(),
}));

jest.mock('react-native-keychain', () => ({
  STORAGE_TYPE: {
    AES_GCM_NO_AUTH: 'KeystoreAESGCM_NoAuth',
  },
  getGenericPassword: jest.fn().mockResolvedValue(false),
  resetGenericPassword: jest.fn().mockResolvedValue(true),
  setGenericPassword: jest.fn().mockResolvedValue({
    service: 'com.s15p11b104app.auth-session',
    storage: 'KeystoreAESGCM_NoAuth',
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () => {
  const storageMock = require('@react-native-async-storage/async-storage/jest');
  return {
    __esModule: true,
    ...storageMock,
    default: storageMock.default,
  };
});

jest.mock('react-native-compressor', () => ({
  Image: {
    compress: jest.fn(uri => Promise.resolve(uri)),
  },
  clearCache: jest.fn(() => Promise.resolve('cleared')),
  createVideoThumbnail: jest.fn(uri =>
    Promise.resolve({
      height: 360,
      mime: 'image/jpeg',
      path: `${uri}.thumbnail.jpg`,
      size: 1,
      width: 640,
    }),
  ),
}));

jest.mock('react-native-fs', () => ({
  __esModule: true,
  default: {
    CachesDirectoryPath: '/cache',
    downloadFile: jest.fn(({toFile}) => ({
      jobId: 1,
      promise: Promise.resolve({bytesWritten: 4, jobId: 1, statusCode: 200}),
    })),
    exists: jest.fn().mockResolvedValue(true),
    mkdir: jest.fn().mockResolvedValue(undefined),
    moveFile: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({size: 4}),
    stopUpload: jest.fn(),
    unlink: jest.fn().mockResolvedValue(undefined),
    uploadFiles: jest.fn(() => ({
      jobId: 1,
      promise: Promise.resolve({body: '', headers: {}, jobId: 1, statusCode: 200}),
    })),
  },
}));
