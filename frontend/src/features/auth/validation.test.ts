import {
  canSubmitSignup,
  doPasswordsMatch,
  isBirthDateNotInFuture,
  isValidLoginId,
  isValidName,
  isValidPassword,
} from './validation';

describe('signup validation', () => {
  it('validates names between 2 and 10 characters', () => {
    expect(isValidName('김')).toBe(false);
    expect(isValidName('김가족')).toBe(true);
    expect(isValidName('열글자를넘어가는긴이름입니다')).toBe(false);
  });

  it('accepts alphanumeric login IDs between 5 and 15 characters', () => {
    expect(isValidLoginId('hello')).toBe(true);
    expect(isValidLoginId('hello1')).toBe(true);
    expect(isValidLoginId('12345')).toBe(true);
    expect(isValidLoginId('abcd')).toBe(false);
    expect(isValidLoginId('hello!')).toBe(false);
    expect(isValidLoginId('가나다라마')).toBe(false);
  });

  it('accepts alphanumeric passwords between 8 and 16 characters', () => {
    expect(isValidPassword('abcdefgh')).toBe(true);
    expect(isValidPassword('abcd1234')).toBe(true);
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword('abcdefg')).toBe(false);
    expect(isValidPassword('abcd123!')).toBe(false);
  });

  it('requires matching passwords', () => {
    expect(doPasswordsMatch('abcdefgh', 'abcdefgh')).toBe(true);
    expect(doPasswordsMatch('abcdefgh', 'abcdefgi')).toBe(false);
  });

  it('rejects future and invalid calendar dates', () => {
    const today = new Date(2026, 6, 29);
    expect(isBirthDateNotInFuture('2026-07-29', today)).toBe(true);
    expect(isBirthDateNotInFuture('2026-07-30', today)).toBe(false);
    expect(isBirthDateNotInFuture('2026-02-30', today)).toBe(false);
  });

  it('accepts a complete signup draft', () => {
    expect(
      canSubmitSignup({
        profileImageUri: null,
        name: '홍유라',
        loginId: 'hongyura',
        password: 'password',
        passwordConfirmation: 'password',
        birthDate: '2000-01-01',
        gender: 'FEMALE',
      }),
    ).toBe(true);
  });
});
