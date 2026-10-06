import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';

/**
 * A autorização do chat é a única coisa impedindo que um usuário leia a
 * negociação de outra organização — e não tinha teste nenhum.
 */
describe('ChatService - autorização', () => {
  const conversation = {
    id: 'conv-1',
    donationListId: 'lista-1',
    reservation: { ngoOrganizationId: 'ngo-1' },
    donationList: { donorOrganizationId: 'donor-1' },
  };

  function buildService(
    organizationUserFindFirst: jest.Mock,
    members: { userId: string }[] = [],
    viewing: string[] = [],
  ) {
    const prisma = {
      conversation: { findUnique: jest.fn().mockResolvedValue(conversation) },
      organizationUser: {
        findFirst: organizationUserFindFirst,
        // Destinatários do aviso de mensagem nova: o serviço já pede com
        // `userId: { not: <remetente> }`, então o dublê devolve a lista crua.
        findMany: jest.fn().mockResolvedValue(members),
      },
      message: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({
          id: 'msg-1',
          body: 'combinado',
          senderUserId: 'user-1',
          createdAt: new Date(),
        }),
      },
      user: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ nodeId: 'LIMEIRA', name: 'Ana' }),
      },
      notification: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
        update: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      },
    };
    const gateway = {
      emitToOrganization: jest.fn(),
      emitToUser: jest.fn(),
      // Quem está com o painel de chat aberto naquele instante.
      findUserIdsViewingConversation: jest.fn().mockResolvedValue(new Set(viewing)),
    };
    return {
      service: new ChatService(prisma as never, gateway as never),
      prisma,
      gateway,
    };
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

  it('notifica o outro lado quando a mensagem é gravada', async () => {
    const { service, prisma, gateway } = buildService(linkedTo('ngo-1'), [{ userId: 'user-2' }]);
    await service.sendMessage('user-1', 'conv-1', 'combinado');

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-2',
          conversationId: 'conv-1',
          type: 'NEW_MESSAGE',
        }),
      }),
    );
    expect(gateway.emitToUser).toHaveBeenCalledWith('user-2', 'notification:new', expect.anything());
  });

  it('reaproveita o aviso ainda não lido em vez de empilhar um por mensagem', async () => {
    const { service, prisma } = buildService(linkedTo('ngo-1'), [{ userId: 'user-2' }]);
    prisma.notification.findFirst.mockResolvedValueOnce({
      id: 'notif-existente',
    });

    await service.sendMessage('user-1', 'conv-1', 'combinado');

    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'notif-existente' } }),
    );
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('não gera aviso quando só o próprio remetente está nas organizações', async () => {
    const { service, prisma } = buildService(linkedTo('ngo-1'), []);
    await service.sendMessage('user-1', 'conv-1', 'combinado');
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('não notifica quem está com a conversa aberta', async () => {
    const { service, prisma, gateway } = buildService(linkedTo('ngo-1'), [{ userId: 'user-2' }], ['user-2']);
    await service.sendMessage('user-1', 'conv-1', 'combinado');

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(gateway.emitToUser).not.toHaveBeenCalled();
    // A mensagem em si continua chegando na tela de quem está lendo.
    expect(gateway.emitToOrganization).toHaveBeenCalledWith('ngo-1', 'message:new', expect.anything());
  });

  it('notifica os destinatários que não estão com a conversa aberta', async () => {
    const { service, prisma } = buildService(
      linkedTo('ngo-1'),
      [{ userId: 'user-2' }, { userId: 'user-3' }],
      ['user-2'],
    );
    await service.sendMessage('user-1', 'conv-1', 'combinado');

    expect(prisma.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-3' }) }),
    );
  });

  it('rejeita conversa inexistente', async () => {
    const { service, prisma } = buildService(linkedTo('ngo-1'));
    prisma.conversation.findUnique.mockResolvedValueOnce(null);
    await expect(service.findMessages('user-1', 'inexistente')).rejects.toThrow(NotFoundException);
  });
});
