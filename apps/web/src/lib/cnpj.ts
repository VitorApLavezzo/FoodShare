import { api } from './api';

export interface CnpjLookupResult {
  found: boolean;
  legalName?: string;
  tradeName?: string;
  phone?: string;
  email?: string;
  address?: {
    street?: string;
    number?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

// Nunca lança: se a consulta falhar (CNPJ inexistente, serviço fora do ar),
// o formulário continua utilizável para preenchimento manual.
export async function fetchCnpjData(document: string): Promise<CnpjLookupResult | null> {
  const digits = document.replace(/\D/g, '');
  if (digits.length !== 14) return null;
  try {
    const { data } = await api.get<CnpjLookupResult>(`/cnpj/${digits}`);
    return data.found ? data : null;
  } catch {
    return null;
  }
}

export function isValidCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calculateDigit = (base: string): number => {
    const weights =
      base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = base.split('').reduce((acc, digit, index) => acc + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const base = digits.slice(0, 12);
  const firstDigit = calculateDigit(base);
  const secondDigit = calculateDigit(base + firstDigit);

  return digits === base + String(firstDigit) + String(secondDigit);
}

export function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}
