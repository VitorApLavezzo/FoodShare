import { forwardRef, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../prisma/prisma.service';
import { ChatService } from '../chat/chat.service';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  nodeId: string;
}

// Gateway único (não um por feature): notificações de proximidade e chat
// doador<->ONG compartilham a mesma conexão Socket.IO/rooms, só variam no nome
// do evento. Rooms: `user:<userId>` (notificações) e `org:<organizationId>`
// (chat, mensagens visíveis a qualquer usuário vinculado a cada organização).
@WebSocketGateway({ cors: { origin: true, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.warn(`Conexão WS rejeitada (sem token): ${client.id}`);
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: this.config.get<string>('jwt.secret'),
      });

      await client.join(`user:${payload.sub}`);

      const orgLinks = await this.prisma.organizationUser.findMany({
        where: { userId: payload.sub },
        select: { organizationId: true },
      });
      await Promise.all(orgLinks.map((link) => client.join(`org:${link.organizationId}`)));

      client.data.userId = payload.sub;
    } catch (err) {
      this.logger.warn(`Conexão WS rejeitada (token inválido): ${client.id}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Desconectado: ${client.id}`);
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitToOrganization(organizationId: string, event: string, payload: unknown) {
    this.server.to(`org:${organizationId}`).emit(event, payload);
  }

  @SubscribeMessage('message:send')
  async handleMessageSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { conversationId: string; body: string },
  ) {
    const userId = client.data.userId as string | undefined;
    if (!userId) return;
    await this.chatService.sendMessage(userId, body.conversationId, body.body);
  }
}
