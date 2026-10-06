import {
  forwardRef,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

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
          {
            donationList: {
              donorOrganization: { users: { some: { userId } } },
            },
          },
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

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const message = await this.prisma.message.create({
      data: { conversationId, senderUserId: userId, body, nodeId: user.nodeId },
    });

    const payload = { ...message, createdAt: message.createdAt.toISOString() };
    this.realtimeGateway.emitToOrganization(
      conversation.donationList.donorOrganizationId,
      'message:new',
      payload,
    );
    this.realtimeGateway.emitToOrganization(
      conversation.reservation.ngoOrganizationId,
      'message:new',
      payload,
    );

    // Best-effort: o `message:new` acima só alcança quem está com o chat aberto.
    // A notificação é o que avisa o outro lado em qualquer outra tela — mas
    // falhar aqui não pode derrubar o envio da mensagem, que já foi gravada.
    try {
      await this.notifyRecipients(conversation, message, user.name);
    } catch (err) {
      this.logger.error(
        `Falha ao notificar a mensagem ${message.id} (a mensagem foi enviada normalmente).`,
        err as Error,
      );
    }

    return message;
  }

  /**
   * Avisa todo mundo das duas organizações da conversa, menos quem escreveu.
   *
   * Uma conversa em andamento geraria uma notificação por mensagem e entupiria
   * o sino, então o alerta ainda não lido de uma conversa é reaproveitado: cada
   * conversa ocupa no máximo uma linha, sempre com a última mensagem.
   */
  private async notifyRecipients(
    conversation: {
      id: string;
      donationListId: string;
      donationList: { donorOrganizationId: string };
      reservation: { ngoOrganizationId: string };
    },
    message: { id: string; body: string; senderUserId: string },
    senderName: string,
  ) {
    const links = await this.prisma.organizationUser.findMany({
      where: {
        organizationId: {
          in: [conversation.donationList.donorOrganizationId, conversation.reservation.ngoOrganizationId],
        },
        userId: { not: message.senderUserId },
      },
      select: { userId: true },
    });

    const recipientIds = [...new Set(links.map((link) => link.userId))];
    if (recipientIds.length === 0) return;

    const title = `Nova mensagem de ${senderName}`;
    const preview = message.body.length > 120 ? `${message.body.slice(0, 120)}…` : message.body;

    for (const userId of recipientIds) {
      const pending = await this.prisma.notification.findFirst({
        where: {
          userId,
          conversationId: conversation.id,
          type: NotificationType.NEW_MESSAGE,
          readAt: null,
        },
        select: { id: true },
      });

      if (pending) {
        await this.prisma.notification.update({
          where: { id: pending.id },
          data: { title, message: preview, createdAt: new Date() },
        });
      } else {
        await this.prisma.notification.create({
          data: {
            userId,
            type: NotificationType.NEW_MESSAGE,
            title,
            message: preview,
            donationListId: conversation.donationListId,
            conversationId: conversation.id,
          },
        });
      }

      this.realtimeGateway.emitToUser(userId, 'notification:new', {
        type: NotificationType.NEW_MESSAGE,
        title,
        message: preview,
        donationListId: conversation.donationListId,
        conversationId: conversation.id,
      });
    }
  }

  private async assertParticipant(userId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { reservation: true, donationList: true },
    });
    if (!conversation) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversa não encontrada.',
      });
    }

    const [isDonorMember, isNgoMember] = await Promise.all([
      this.prisma.organizationUser.findFirst({
        where: {
          userId,
          organizationId: conversation.donationList.donorOrganizationId,
        },
      }),
      this.prisma.organizationUser.findFirst({
        where: {
          userId,
          organizationId: conversation.reservation.ngoOrganizationId,
        },
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
