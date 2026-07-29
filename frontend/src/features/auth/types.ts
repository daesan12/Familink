export type Gender = 'MALE' | 'FEMALE';

export type SignupStep = 1 | 2 | 3 | 4 | 5;

export interface SignupDraft {
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
