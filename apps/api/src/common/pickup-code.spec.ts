import { generatePickupCode } from './pickup-code';

describe('generatePickupCode', () => {
  it('gera um código de 6 caracteres por padrão', () => {
    expect(generatePickupCode()).toHaveLength(6);
  });

  it('nunca usa caracteres ambíguos (0, O, 1, I)', () => {
    for (let i = 0; i < 200; i++) {
      const code = generatePickupCode();
      expect(code).not.toMatch(/[01OI]/);
    }
  });

  it('respeita o comprimento customizado', () => {
    expect(generatePickupCode(10)).toHaveLength(10);
  });

  it('gera códigos distintos entre chamadas (extremamente improvável colidir)', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generatePickupCode()));
    expect(codes.size).toBeGreaterThan(90);
  });
});
