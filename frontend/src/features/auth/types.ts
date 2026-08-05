export type Gender = 'MALE' | 'FEMALE';

export type SignupStep = 1 | 2 | 3 | 4 | 5;

export interface SignupDraft {
  profileImageAsset?: import('../profile/types').ProfileImageAsset | null;
  profileImageUri: string | null;
  name: string;
  loginId: string;
  password: string;
  passwordConfirmation: string;
  birthDate: string;
  gender: Gender | null;
}

export type LoginIdAvailability =
  | 'idle'
  | 'checking'
  | 'available'
  | 'duplicated';

export interface LoginCredentials {
  loginId: string;
  password: string;
}

export interface LoginRequestOptions {
  signal?: AbortSignal;
}

export interface AuthenticatedUser {
  activeGroupId: string | null;
  id: number;
  name: string;
}

export interface AuthGateway {
  getAccessToken?(): Promise<string | null> | string | null;
  login(
    credentials: LoginCredentials,
    options?: LoginRequestOptions,
  ): Promise<AuthenticatedUser>;
  logout(): Promise<void>;
}
