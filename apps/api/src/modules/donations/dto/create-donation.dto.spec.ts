import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDonationDto } from './create-donation.dto';

const validPayload = {
  foodName: 'Arroz',
  category: 'PACKAGED_GOODS',
  quantity: 10,
  unit: 'kg',
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

  it('rejeita quantidade negativa', async () => {
    const errors = await validatePayload({ quantity: -5 });
    expect(errors.some((e) => e.property === 'quantity')).toBe(true);
  });

  it('rejeita quantidade zero (deve ser positiva)', async () => {
    const errors = await validatePayload({ quantity: 0 });
    expect(errors.some((e) => e.property === 'quantity')).toBe(true);
  });

  it('rejeita categoria fora do enum', async () => {
    const errors = await validatePayload({ category: 'INVALID_CATEGORY' as never });
    expect(errors.some((e) => e.property === 'category')).toBe(true);
  });

  it('rejeita datas que não são ISO 8601', async () => {
    const errors = await validatePayload({ expiresAt: 'não é uma data' });
    expect(errors.some((e) => e.property === 'expiresAt')).toBe(true);
  });
});
