const UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

// Converte strings simples de expiração JWT (ex: "15m", "7d") em milissegundos.
export function parseDurationMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim());
  if (!match) {
    throw new Error(`Formato de duração inválido: "${value}" (use algo como 15m, 7d).`);
  }
  const [, amount, unit] = match;
  return parseInt(amount, 10) * UNIT_MS[unit];
}
