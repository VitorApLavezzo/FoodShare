import type { UserRole } from '@foodshare/types';

/**
 * A última conta que entrou neste aparelho, para o login mostrar "Continuar
 * como Camila · ONG" — é assim que a pessoa vê o tipo de conta antes de entrar.
 *
 * Fica só no navegador, de propósito: perguntar ao servidor o tipo de conta de
 * um e-mail digitado deixaria qualquer um descobrir quem tem conta e como (o
 * "Esqueci minha senha" evita revelar isso pelo mesmo motivo). Aqui só aparece
 * o que este aparelho já sabia.
 */
export interface RememberedAccount {
  name: string;
  email: string;
  role: UserRole;
}

const KEY = 'foodshare.lastAccount';

// O armazenamento pode falhar (aba anônima, cota cheia, bloqueio do navegador):
// lembrar a conta é conveniência, nunca motivo para quebrar o login.
export function getRememberedAccount(): RememberedAccount | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedAccount>;
    if (!parsed.email || !parsed.name || !parsed.role) return null;
    return { name: parsed.name, email: parsed.email, role: parsed.role };
  } catch {
    return null;
  }
}

export function rememberAccount(account: RememberedAccount) {
  try {
    localStorage.setItem(KEY, JSON.stringify(account));
  } catch {
    // Sem armazenamento, o login só não oferece o atalho na próxima vez.
  }
}

export function forgetRememberedAccount() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Idem.
  }
}
