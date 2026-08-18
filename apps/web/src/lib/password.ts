export interface PasswordChecks {
  minLength: boolean;
  hasUppercase: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
}

export type PasswordStrength = 'fraca' | 'média' | 'forte';

export function checkPassword(password: string): PasswordChecks {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };
}

export function isStrongPassword(password: string): boolean {
  const checks = checkPassword(password);
  return checks.minLength && checks.hasUppercase && checks.hasNumber && checks.hasSpecial;
}

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 'fraca';
  const checks = checkPassword(password);
  const requirementsMet = [checks.minLength, checks.hasUppercase, checks.hasNumber, checks.hasSpecial].filter(
    Boolean,
  ).length;

  if (requirementsMet < 4) return 'fraca';
  return password.length >= 12 ? 'forte' : 'média';
}
