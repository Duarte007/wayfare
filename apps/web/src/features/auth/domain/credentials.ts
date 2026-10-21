/** Matches the Supabase Auth minimum configured in supabase/config.toml. */
export const MIN_PASSWORD_LENGTH = 10;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}

export function isStrongEnough(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

export function isValidCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}
