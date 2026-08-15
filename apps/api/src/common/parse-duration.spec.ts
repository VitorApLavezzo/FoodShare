import { parseDurationMs } from './parse-duration';

describe('parseDurationMs', () => {
  it.each([
    ['15m', 15 * 60_000],
    ['7d', 7 * 86_400_000],
    ['1h', 3_600_000],
    ['30s', 30_000],
  ])('converte "%s" para %d ms', (input, expected) => {
    expect(parseDurationMs(input)).toBe(expected);
  });

  it('rejeita formato inválido', () => {
    expect(() => parseDurationMs('15 minutes')).toThrow();
    expect(() => parseDurationMs('abc')).toThrow();
    expect(() => parseDurationMs('')).toThrow();
  });
});
