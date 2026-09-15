import {
  ApprovalStatus,
  DonationCategory,
  DonationItemStatus,
  DonationListStatus,
  NotificationType,
  OrganizationType,
  ReservationStatus,
} from '@prisma/client';
import {
  APPROVAL_STATUS_LABEL,
  DONATION_CATEGORY_LABEL,
  DONATION_ITEM_STATUS_LABEL,
  DONATION_LIST_STATUS_LABEL,
  NOTIFICATION_TYPE_LABEL,
  ORGANIZATION_TYPE_LABEL,
  RESERVATION_STATUS_LABEL,
} from '../../../../packages/types/src/index';

/**
 * O frontend consome os enums de @foodshare/types em vez de redeclará-los. Este
 * teste é o que garante que esse espelho não saia de sincronia com o
 * schema.prisma: adicionar um valor no banco sem refletir no pacote (ou o
 * contrário) quebra aqui, e não em produção com um rótulo vazio na tela.
 */
describe('@foodshare/types espelha os enums do Prisma', () => {
  const cases: [string, object, object][] = [
    ['DonationCategory', DonationCategory, DONATION_CATEGORY_LABEL],
    ['DonationListStatus', DonationListStatus, DONATION_LIST_STATUS_LABEL],
    ['DonationItemStatus', DonationItemStatus, DONATION_ITEM_STATUS_LABEL],
    ['ReservationStatus', ReservationStatus, RESERVATION_STATUS_LABEL],
    ['NotificationType', NotificationType, NOTIFICATION_TYPE_LABEL],
    ['OrganizationType', OrganizationType, ORGANIZATION_TYPE_LABEL],
    ['ApprovalStatus', ApprovalStatus, APPROVAL_STATUS_LABEL],
  ];

  it.each(cases)('%s tem exatamente os mesmos valores nos dois lados', (_name, prismaEnum, sharedLabels) => {
    expect(Object.keys(sharedLabels).sort()).toEqual(Object.keys(prismaEnum).sort());
  });

  it('todo valor tem um rótulo em português não vazio', () => {
    for (const [, , labels] of cases) {
      for (const [key, label] of Object.entries(labels)) {
        expect(typeof label === 'string' && label.length > 0).toBe(true);
        expect(label).not.toBe(key);
      }
    }
  });
});
