/* eslint-env jest */

jest.mock('react-native-config', () => ({
  __esModule: true,
  default: {
    API_BASE_URL: 'http://10.0.2.2:8080',
  },
}));

// lucide-react-native exposes ESM-only icon entry points. Jest's React Native
// preset does not transform those files, so keep the icon as a lightweight
// host component in tests.
jest.mock('lucide-react-native/icons/trash-2', () => 'Trash2');

// 패키지 루트도 ESM이라 같은 이유로 파싱에 실패한다. 아이콘 이름을 그대로
// host 컴포넌트로 돌려주어 앱 셸을 포함한 통합 테스트가 실행되게 한다.
jest.mock('lucide-react-native', () => {
  return new Proxy(
    {__esModule: true},
    {
      get: (target, property) => {
        if (property in target) {
          return target[property];
        }
        // 심볼 키까지 문자열로 돌려주면 Symbol.toPrimitive·Symbol.iterator가
        // 문자열이 되어 이 모듈을 출력하거나 펼치는 순간 TypeError가 난다.
        return typeof property === 'string' ? property : undefined;
      },
    },
  );
});

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
