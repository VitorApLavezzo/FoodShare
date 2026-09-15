import { forwardRef, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => RealtimeGateway))
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  /**
   * Uma conversa por reserva (1:1). Recebe o client da transação da reserva:
   * a conversa nasce junto com a reserva, no mesmo commit — antes ela era criada
   * depois do commit e uma falha ali deixava a reserva permanentemente sem chat.
   */
  createConversationForReservation(
    tx: Prisma.TransactionClient,
    reservationId: string,
    donationListId: string,
  ) {
    return tx.conversation.create({ data: { reservationId, donationListId } });
  }

  notifyConversationCreated(params: {
    conversationId: string;
    reservationId: string;
    donationListId: string;
    donorOrganizationId: string;
    ngoOrganizationId: string;
  }) {
    const payload = {
      conversationId: params.conversationId,
      reservationId: params.reservationId,
      donationListId: params.donationListId,
    };
    this.realtimeGateway.emitToOrganization(params.donorOrganizationId, 'conversation:created', payload);
    this.realtimeGateway.emitToOrganization(params.ngoOrganizationId, 'conversation:created', payload);
  }

  async findConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        OR: [
          { reservation: { ngoOrganization: { users: { some: { userId } } } } },
          { donationList: { donorOrganization: { users: { some: { userId } } } } },
        ],
      },
      include: {
        reservation: { include: { ngoOrganization: true } },
        donationList: { include: { donorOrganization: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findMessages(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(userId: string, conversationId: string, body: string) {
    const conversation = await this.assertParticipant(userId, conversationId);

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const message = await this.prisma.message.create({
      data: { conversationId, senderUserId: userId, body, nodeId: user.nodeId },
    });

    const payload = { ...message, createdAt: message.createdAt.toISOString() };
    this.realtimeGateway.emitToOrganization(conversation.donationList.donorOrganizationId, 'message:new', payload);
    this.realtimeGateway.emitToOrganization(conversation.reservation.ngoOrganizationId, 'message:new', payload);

    return message;
  }

  private async assertParticipant(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { reservation: true, donationList: true },
    });
    if (!conversation) {
      throw new NotFoundException({ code: 'CONVERSATION_NOT_FOUND', message: 'Conversa não encontrada.' });
    }

    const [isDonorMember, isNgoMember] = await Promise.all([
      this.prisma.organizationUser.findFirst({
        where: { userId, organizationId: conversation.donationList.donorOrganizationId },
      }),
      this.prisma.organizationUser.findFirst({
        where: { userId, organizationId: conversation.reservation.ngoOrganizationId },
      }),
    ]);

    if (!isDonorMember && !isNgoMember) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_CONVERSATION_ACCESS',
        message: 'Você não tem acesso a esta conversa.',
      });
    }

    return conversation;
  }
}
