import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';

/**
 * A autorização do chat é a única coisa impedindo que um usuário leia a
 * negociação de outra organização — e não tinha teste nenhum.
 */
describe('ChatService - autorização', () => {
  const conversation = {
    id: 'conv-1',
    reservation: { ngoOrganizationId: 'ngo-1' },
    donationList: { donorOrganizationId: 'donor-1' },
  };

  function buildService(organizationUserFindFirst: jest.Mock) {
    const prisma = {
      conversation: { findUnique: jest.fn().mockResolvedValue(conversation) },
      organizationUser: { findFirst: organizationUserFindFirst },
      message: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'msg-1', body: 'combinado', createdAt: new Date() }),
      },
      user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ nodeId: 'LIMEIRA' }) },
    };
    const gateway = { emitToOrganization: jest.fn() };
    return { service: new ChatService(prisma as never, gateway as never), prisma, gateway };
  }

  // Simula o vínculo usuário<->organização: responde apenas quando o par bate.
  const linkedTo = (organizationId: string) =>
    jest.fn(({ where }: { where: { organizationId: string } }) =>
      Promise.resolve(where.organizationId === organizationId ? { id: 'link' } : null),
    );

  it('permite que um usuário da ONG da reserva leia a conversa', async () => {
    const { service } = buildService(linkedTo('ngo-1'));
    await expect(service.findMessages('user-1', 'conv-1')).resolves.toEqual([]);
  });

  it('permite que um usuário do doador da lista leia a conversa', async () => {
    const { service } = buildService(linkedTo('donor-1'));
    await expect(service.findMessages('user-1', 'conv-1')).resolves.toEqual([]);
  });

  it('bloqueia quem não pertence a nenhum dos dois lados', async () => {
    const { service } = buildService(linkedTo('outra-org'));
    await expect(service.findMessages('intruso', 'conv-1')).rejects.toThrow(ForbiddenException);
  });

  it('bloqueia o envio de mensagem por quem não participa', async () => {
    const { service, prisma } = buildService(linkedTo('outra-org'));
    await expect(service.sendMessage('intruso', 'conv-1', 'oi')).rejects.toThrow(ForbiddenException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('avisa os dois lados quando a mensagem é aceita', async () => {
    const { service, gateway } = buildService(linkedTo('ngo-1'));
    await service.sendMessage('user-1', 'conv-1', 'combinado');
    expect(gateway.emitToOrganization).toHaveBeenCalledWith('donor-1', 'message:new', expect.anything());
    expect(gateway.emitToOrganization).toHaveBeenCalledWith('ngo-1', 'message:new', expect.anything());
  });

  it('rejeita conversa inexistente', async () => {
    const { service, prisma } = buildService(linkedTo('ngo-1'));
    prisma.conversation.findUnique.mockResolvedValueOnce(null);
    await expect(service.findMessages('user-1', 'inexistente')).rejects.toThrow(NotFoundException);
  });
});
