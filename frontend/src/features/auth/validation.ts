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

// 비밀번호 규칙 안내 문구. 화면과 위반 사유가 같은 기준(SIGNUP_LIMITS)을 쓰게 한 곳에 모은다.
export const PASSWORD_RULE_MESSAGE = `영문과 숫자를 각각 1자 이상 포함해 ${SIGNUP_LIMITS.passwordMin} ~ ${SIGNUP_LIMITS.passwordMax}자로 입력해주세요.`;

// 비밀번호 규칙 위반 이유를 입력 중 안내한다. 규칙을 지켰거나 아직 비어 있으면 null.
export function getPasswordRuleViolation(password: string): string | null {
  if (password.length === 0 || isValidPassword(password)) {
    return null;
  }
  if (!ALPHANUMERIC_PATTERN.test(password)) {
    return '비밀번호에는 영문과 숫자만 사용할 수 있어요.';
  }
  if (
    password.length < SIGNUP_LIMITS.passwordMin ||
    password.length > SIGNUP_LIMITS.passwordMax
  ) {
    return `비밀번호는 ${SIGNUP_LIMITS.passwordMin} ~ ${SIGNUP_LIMITS.passwordMax}자로 입력해주세요.`;
  }
  if (!LETTER_PATTERN.test(password)) {
    return '영문을 1자 이상 포함해주세요.';
  }
  return '숫자를 1자 이상 포함해주세요.';
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
