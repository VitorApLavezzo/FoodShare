import { BadRequestException } from '@nestjs/common';
import { assertValidDonationDates, latestItemDates, resolveItemDates } from './donation-dates';

const HOUR = 3_600_000;
const postedAt = new Date('2026-10-29T12:00:00Z');
const at = (hoursAfterPosting: number) => new Date(postedAt.getTime() + hoursAfterPosting * HOUR);

describe('regras de data da doação', () => {
  describe('assertValidDonationDates', () => {
    const check = (pickupHours: number, expiresHours: number) =>
      assertValidDonationDates(postedAt, postedAt, [
        { foodName: 'Arroz', pickupDeadline: at(pickupHours), expiresAt: at(expiresHours) },
      ]);

    it('aceita retirada 1 dia depois da publicação e validade 1 dia depois da retirada', () => {
      expect(() => check(24, 48)).not.toThrow();
    });

    it('recusa prazo de retirada com menos de 1 dia desde a publicação', () => {
      expect(() => check(23, 72)).toThrow(BadRequestException);
    });

    it('recusa validade no mesmo dia do prazo de retirada', () => {
      expect(() => check(30, 40)).toThrow(BadRequestException);
    });

    it('recusa prazo de retirada antes do início da disponibilidade', () => {
      expect(() =>
        assertValidDonationDates(at(48), postedAt, [
          { foodName: 'Arroz', pickupDeadline: at(30), expiresAt: at(80) },
        ]),
      ).toThrow(BadRequestException);
    });

    it('aponta o alimento quando a lista tem mais de um item', () => {
      expect(() =>
        assertValidDonationDates(postedAt, postedAt, [
          { foodName: 'Arroz', pickupDeadline: at(24), expiresAt: at(48) },
          { foodName: 'Pão', pickupDeadline: at(24), expiresAt: at(30) },
        ]),
      ).toThrow(/"Pão"/);
    });
  });

  describe('resolveItemDates', () => {
    it('usa a data da lista para o item que não trouxe a própria', () => {
      const [dates] = resolveItemDates({
        allowPartial: true,
        pickupDeadline: at(24).toISOString(),
        expiresAt: at(48).toISOString(),
        items: [{ foodName: 'Arroz' }],
      });
      expect(dates).toEqual({ pickupDeadline: at(24), expiresAt: at(48) });
    });

    it('exige validade em cada item', () => {
      expect(() =>
        resolveItemDates({
          allowPartial: true,
          items: [{ foodName: 'Arroz', pickupDeadline: at(24).toISOString() }],
        }),
      ).toThrow(BadRequestException);
    });

    it('com aceite parcial, cada item pode ter o seu prazo de retirada', () => {
      const dates = resolveItemDates({
        allowPartial: true,
        items: [
          { foodName: 'Arroz', pickupDeadline: at(24).toISOString(), expiresAt: at(72).toISOString() },
          { foodName: 'Pão', pickupDeadline: at(30).toISOString(), expiresAt: at(60).toISOString() },
        ],
      });
      expect(latestItemDates(dates)).toEqual({ pickupDeadline: at(30), expiresAt: at(72) });
    });

    it('sem aceite parcial, o prazo de retirada é um só', () => {
      expect(() =>
        resolveItemDates({
          allowPartial: false,
          items: [
            { foodName: 'Arroz', pickupDeadline: at(24).toISOString(), expiresAt: at(72).toISOString() },
            { foodName: 'Pão', pickupDeadline: at(30).toISOString(), expiresAt: at(72).toISOString() },
          ],
        }),
      ).toThrow(BadRequestException);
    });
  });
});
