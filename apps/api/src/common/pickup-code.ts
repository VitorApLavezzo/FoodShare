import { randomInt } from 'crypto';

// Exclui caracteres ambíguos (0/O, 1/I) para facilitar leitura na retirada presencial.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePickupCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
