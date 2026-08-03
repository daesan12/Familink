import axios, {type AxiosInstance} from 'axios';

import {
  ApiError,
  apiClient,
  createApiClient,
  isApiSuccess,
  normalizeApiError,
  type ApiAuthSession,
  type ApiSuccess,
} from '../../../shared/api';
import {
  hasInvalidFileNameCharacter,
  PROFILE_IMAGE_LIMITS,
} from '../profileModel';
import type {Gender, ProfileImageAsset} from '../types';

export interface UserProfile {
  birthDate: string;
  gender: Gender;
  loginId: string;
  name: string;
  profileImageUrl: string | null;
}

export interface ProfileUpdateInput {
  birthDate?: string;
  gender?: 'FEMALE' | 'MALE';
  loginId?: string;
  name?: string;
  profileImageUrl?: string | null;
}

export interface ProfileUpdateResult {
  id: string;
  name: string;
  updatedAt: string;
}

export interface ProfileGateway {
  loadCurrentProfile(): Promise<UserProfile>;
  uploadProfileImage(asset: ProfileImageAsset): Promise<string>;
  updateCurrentProfile(input: ProfileUpdateInput): Promise<ProfileUpdateResult>;
  withdrawCurrentUser(): Promise<void>;
}

export type ProfileHttpClient = Pick<
  AxiosInstance,
  'delete' | 'get' | 'patch' | 'post'
>;

interface ProfileUploadRequestConfig {
  headers: Record<string, string>;
}

export interface ProfileUploadTransport {
  readFile(uri: string): Promise<Blob>;
  put(
    uploadUrl: string,
    data: Blob,
    config: ProfileUploadRequestConfig,
  ): Promise<void>;
}

export interface ProfileGatewayOptions {
  authSession?: ApiAuthSession;
  baseUrl?: string;
  client?: ProfileHttpClient;
  uploadTransport?: ProfileUploadTransport;
}

const defaultUploadTransport: ProfileUploadTransport = {
  async readFile(uri) {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new ApiError({
        code: 'MEDIA_READ_FAILED',
        kind: 'network',
        message: '선택한 사진을 읽지 못했습니다.',
        status: response.status,
      });
    }
    return response.blob();
  },
  async put(uploadUrl, data, config) {
    await axios.put(uploadUrl, data, {headers: config.headers});
  },
};

export function createProfileGateway(
  options: ProfileGatewayOptions = {},
): ProfileGateway {
  const client =
    options.client ??
    (options.baseUrl === undefined && options.authSession === undefined
      ? apiClient
      : createApiClient(options.baseUrl, options.authSession));
  const uploadTransport = options.uploadTransport ?? defaultUploadTransport;

  return {
    async loadCurrentProfile() {
      const response = await client.get<ApiSuccess<unknown>>('/users/me');
      return parseApiEnvelope(response.data, response.status, parseUserProfile);
    },

    async uploadProfileImage(asset) {
      assertProfileImageAsset(asset);

      try {
        let blob: Blob;
        try {
          blob = await uploadTransport.readFile(asset.uri);
        } catch (error) {
          throw mediaReadFailed(error);
        }
        assertProfileImageBlob(blob);

        const response = await client.post<ApiSuccess<unknown>>(
          '/files/presigned-urls',
          {
            files: [
              {
                contentType: asset.contentType,
                fileName: asset.fileName,
                sizeBytes: blob.size,
              },
            ],
            purpose: 'profile-image',
          },
        );
        if (response.status !== 201) {
          throw invalidResponse(response.status);
        }
        const upload = parseApiEnvelope(
          response.data,
          response.status,
          parseProfileImageUpload,
        );
        try {
          await uploadTransport.put(upload.uploadUrl, blob, {
            headers: upload.headers,
          });
        } catch (error) {
          throw mediaUploadFailed(error);
        }
        return upload.fileUrl;
      } catch (error) {
        throw normalizeApiError(error);
      }
    },

    async updateCurrentProfile(input) {
      const response = await client.patch<ApiSuccess<unknown>>(
        '/users/me',
        input,
      );
      return parseApiEnvelope(
        response.data,
        response.status,
        parseProfileUpdateResult,
      );
    },

    async withdrawCurrentUser() {
      const response = await client.delete('/users/me');
      if (response.status !== 204) {
        throw invalidResponse(response.status);
      }
    },
  };
}

export const profileGateway = createProfileGateway();

export function getProfileSaveErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return '잠시 후 다시 시도해 주세요.';
  }

  switch (error.code) {
    case 'MEDIA_READ_FAILED':
      return '선택한 사진을 읽지 못했습니다. 다른 사진을 선택해 주세요.';
    case 'MEDIA_UPLOAD_FAILED':
      return '프로필 이미지 업로드에 실패했습니다. 다시 시도해 주세요.';
    case 'INVALID_REQUEST':
      return '선택한 사진 또는 입력 값을 확인해 주세요.';
    case 'UNAUTHORIZED':
      return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
    case 'FORBIDDEN':
      return '프로필을 수정할 권한이 없습니다.';
    case 'NETWORK_ERROR':
    case 'API_TIMEOUT':
      return '네트워크 연결을 확인하고 다시 시도해 주세요.';
    default:
      return error.message || '잠시 후 다시 시도해 주세요.';
  }
}

export function getProfileWithdrawErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return '잠시 후 다시 시도해 주세요.';
  }

  switch (error.code) {
    case 'MANAGER_TRANSFER_REQUIRED':
      return '회원 탈퇴 전에 먼저 그룹 관리자를 다른 구성원에게 위임해 주세요.';
    case 'UNAUTHORIZED':
      return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
    case 'FORBIDDEN':
      return '회원 탈퇴 권한이 없습니다.';
    case 'NETWORK_ERROR':
    case 'API_TIMEOUT':
      return '네트워크 연결을 확인하고 다시 시도해 주세요.';
    default:
      return error.message || '잠시 후 다시 시도해 주세요.';
  }
}

function parseApiEnvelope<T>(
  envelope: unknown,
  status: number,
  parseData: (value: unknown) => T | null,
): T {
  const data = isApiSuccess(envelope) ? parseData(envelope.data) : null;
  if (data !== null) {
    return data;
  }

  throw invalidResponse(status);
}

function parseUserProfile(value: unknown): UserProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const birthDate = readIsoDate(value.birthDate);
  const gender = readGender(value.gender);
  const loginId = readNonEmptyString(value.loginId);
  const name = readNonEmptyString(value.name);
  const profileImageUrl = readNullableString(value.profileImageUrl);
  if (
    birthDate === null ||
    gender === null ||
    loginId === null ||
    name === null ||
    profileImageUrl === undefined
  ) {
    return null;
  }

  return {birthDate, gender, loginId, name, profileImageUrl};
}

function parseProfileUpdateResult(value: unknown): ProfileUpdateResult | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readPositiveId(value.id);
  const name = readNonEmptyString(value.name);
  const updatedAt = readInstant(value.updatedAt);
  if (id === null || name === null || updatedAt === null) {
    return null;
  }

  return {id, name, updatedAt};
}

interface ProfileImageUpload {
  expiresAt: string;
  fileUrl: string;
  headers: Record<string, string>;
  uploadUrl: string;
}

function parseProfileImageUpload(value: unknown): ProfileImageUpload | null {
  if (!isRecord(value) || !Array.isArray(value.uploads)) {
    return null;
  }
  if (value.uploads.length !== 1 || !isRecord(value.uploads[0])) {
    return null;
  }

  const upload = value.uploads[0];
  const uploadUrl = readNonEmptyString(upload.uploadUrl);
  const fileUrl = readNonEmptyString(upload.fileUrl);
  const expiresAt = readInstant(upload.expiresAt);
  const headers = readStringRecord(upload.headers);
  if (
    uploadUrl === null ||
    fileUrl === null ||
    expiresAt === null ||
    headers === null ||
    !Object.keys(headers).some(key => key.toLowerCase() === 'content-type')
  ) {
    return null;
  }

  return {expiresAt, fileUrl, headers, uploadUrl};
}

function readStringRecord(value: unknown): Record<string, string> | null {
  if (!isRecord(value)) {
    return null;
  }

  const entries = Object.entries(value);
  if (
    entries.length === 0 ||
    entries.some(
      ([key, item]) => key.trim().length === 0 || typeof item !== 'string',
    )
  ) {
    return null;
  }
  return Object.fromEntries(entries) as Record<string, string>;
}

function assertProfileImageAsset(asset: ProfileImageAsset): void {
  const allowedTypes: readonly string[] = PROFILE_IMAGE_LIMITS.allowedTypes;
  if (
    !allowedTypes.includes(asset.contentType) ||
    asset.uri.trim().length === 0 ||
    asset.fileName.trim().length === 0 ||
    asset.fileName.length > 255 ||
    hasInvalidFileNameCharacter(asset.fileName)
  ) {
    throw new ApiError({
      code: 'INVALID_REQUEST',
      kind: 'server',
      message: '업로드할 프로필 이미지 정보가 올바르지 않습니다.',
      status: 400,
    });
  }
}

function assertProfileImageBlob(blob: Blob): void {
  if (
    !Number.isSafeInteger(blob.size) ||
    blob.size <= 0 ||
    blob.size > PROFILE_IMAGE_LIMITS.maxSizeBytes
  ) {
    throw new ApiError({
      code: 'INVALID_REQUEST',
      kind: 'server',
      message: '프로필 이미지는 10MiB 이하의 비어 있지 않은 파일이어야 합니다.',
      status: 400,
    });
  }
}

function mediaReadFailed(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  return new ApiError({
    code: 'MEDIA_READ_FAILED',
    kind: 'network',
    message: '선택한 사진을 읽지 못했습니다.',
    originalError: error,
  });
}

function mediaUploadFailed(error: unknown): ApiError {
  return new ApiError({
    code: 'MEDIA_UPLOAD_FAILED',
    kind:
      axios.isAxiosError(error) && error.response !== undefined
        ? 'server'
        : 'network',
    message: '프로필 이미지 업로드에 실패했습니다. 다시 시도해 주세요.',
    originalError: error,
    status: axios.isAxiosError(error) ? error.response?.status : undefined,
  });
}

function readGender(value: unknown): Gender | null {
  if (value === 'MALE') {
    return 'male';
  }
  if (value === 'FEMALE') {
    return 'female';
  }
  return null;
}

function readIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10) === value ? value : null;
}

function readInstant(value: unknown): string | null {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    return null;
  }
  return value;
}

function readNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readNullableString(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  return readNonEmptyString(value) ?? undefined;
}

function readPositiveId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) {
    return String(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? value : null;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalidResponse(status?: number): ApiError {
  return new ApiError({
    code: 'INVALID_API_RESPONSE',
    kind: 'invalidResponse',
    message: '서버가 예상하지 못한 응답을 반환했습니다.',
    status,
  });
}
