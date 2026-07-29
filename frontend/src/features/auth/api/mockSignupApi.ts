import type {SignupDraft} from '../types';

const DUPLICATED_LOGIN_IDS = new Set(['cute', 'familink', 'alreadyused']);
const MOCK_DELAY_MS = 350;

function wait(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, MOCK_DELAY_MS));
}

export async function checkLoginIdAvailability(
  loginId: string,
): Promise<boolean> {
  await wait();
  return !DUPLICATED_LOGIN_IDS.has(loginId.toLowerCase());
}

export async function submitSignup(_draft: SignupDraft): Promise<void> {
  await wait();
}
