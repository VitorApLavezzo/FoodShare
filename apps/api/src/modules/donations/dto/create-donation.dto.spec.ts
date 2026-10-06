import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDonationDto } from './create-donation.dto';

const validPayload = {
  allowPartial: true,
  items: [{ foodName: 'Arroz', category: 'PACKAGED_GOODS', quantity: 10, unit: 'kg' }],
  availableAt: '2026-08-15T14:00:00Z',
  pickupDeadline: '2026-08-16T14:00:00Z',
  expiresAt: '2026-08-20T14:00:00Z',
};

async function validatePayload(overrides: Partial<typeof validPayload>) {
  const dto = plainToInstance(CreateDonationDto, { ...validPayload, ...overrides });
  return validate(dto);
}

describe('CreateDonationDto', () => {
  it('aceita um payload válido sem erros', async () => {
    const errors = await validatePayload({});
    expect(errors).toHaveLength(0);
  });

  it('rejeita lista sem itens', async () => {
    const errors = await validatePayload({ items: [] });
    expect(errors.some((e) => e.property === 'items')).toBe(true);
  });

  it('rejeita quantidade negativa de um item', async () => {
    const errors = await validatePayload({
      items: [{ foodName: 'Arroz', category: 'PACKAGED_GOODS', quantity: -5, unit: 'kg' }],
    });
    expect(errors.some((e) => e.property === 'items')).toBe(true);
  });

  it('rejeita quantidade zero de um item (deve ser positiva)', async () => {
    const errors = await validatePayload({
      items: [{ foodName: 'Arroz', category: 'PACKAGED_GOODS', quantity: 0, unit: 'kg' }],
    });
    expect(errors.some((e) => e.property === 'items')).toBe(true);
  });

  it('rejeita categoria fora do enum em um item', async () => {
    const errors = await validatePayload({
      items: [{ foodName: 'Arroz', category: 'INVALID_CATEGORY', quantity: 10, unit: 'kg' }],
    });
    expect(errors.some((e) => e.property === 'items')).toBe(true);
  });

  it('rejeita datas que não são ISO 8601', async () => {
    const errors = await validatePayload({ expiresAt: 'não é uma data' });
    expect(errors.some((e) => e.property === 'expiresAt')).toBe(true);
  });
});
