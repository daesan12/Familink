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
    exists: jest.fn().mockResolvedValue(true),
    unlink: jest.fn().mockResolvedValue(undefined),
  },
}));
