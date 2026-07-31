import type {LoginCredentials, SignupDraft} from './types';

export const SIGNUP_LIMITS = {
  nameMin: 2,
  nameMax: 10,
  loginIdMin: 5,
  loginIdMax: 15,
  passwordMin: 8,
  passwordMax: 16,
} as const;

const ALPHANUMERIC_PATTERN = /^[A-Za-z0-9]+$/;
const LETTER_PATTERN = /[A-Za-z]/;
const DIGIT_PATTERN = /[0-9]/;

export function isValidName(name: string): boolean {
  const length = Array.from(name.trim()).length;
  return length >= SIGNUP_LIMITS.nameMin && length <= SIGNUP_LIMITS.nameMax;
}

export function isValidLoginId(loginId: string): boolean {
  return (
    loginId.length >= SIGNUP_LIMITS.loginIdMin &&
    loginId.length <= SIGNUP_LIMITS.loginIdMax &&
    ALPHANUMERIC_PATTERN.test(loginId)
  );
}

export function isValidPassword(password: string): boolean {
  return (
    password.length >= SIGNUP_LIMITS.passwordMin &&
    password.length <= SIGNUP_LIMITS.passwordMax &&
    ALPHANUMERIC_PATTERN.test(password) &&
    LETTER_PATTERN.test(password) &&
    DIGIT_PATTERN.test(password)
  );
}

export function doPasswordsMatch(
  password: string,
  confirmation: string,
): boolean {
  return password.length > 0 && password === confirmation;
}

export function isBirthDateNotInFuture(
  birthDate: string,
  today = new Date(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return false;
  }

  const [year, month, day] = birthDate.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return false;
  }

  const selected = new Date(year, month - 1, day);
  const normalizedToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  return (
    selected.getFullYear() === year &&
    selected.getMonth() === month - 1 &&
    selected.getDate() === day &&
    selected <= normalizedToday
  );
}

export function canSubmitSignup(draft: SignupDraft): boolean {
  return (
    isValidName(draft.name) &&
    isValidLoginId(draft.loginId) &&
    isValidPassword(draft.password) &&
    doPasswordsMatch(draft.password, draft.passwordConfirmation) &&
    isBirthDateNotInFuture(draft.birthDate) &&
    draft.gender !== null
  );
}

export function canSubmitLogin(credentials: LoginCredentials): boolean {
  return (
    credentials.loginId.trim().length > 0 &&
    credentials.password.trim().length > 0
  );
}
