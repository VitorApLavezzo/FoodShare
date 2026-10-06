import { forwardRef, Inject, Logger, UsePipes, ValidationPipe } from '@nestjs/common';
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
import { SendMessageWsDto } from './dto/send-message.dto';
import { ConversationRoomDto } from './dto/conversation-room.dto';

// `Socket.data` é `any` por padrão: declarar o que guardamos ali é o que faz o
// `userId` continuar verificado nos handlers.
interface SocketData {
  userId: string;
}

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
// A origem vem da mesma config do CORS HTTP: com `origin: true` qualquer site
// conseguiria abrir um socket autenticado se tivesse o token.
@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  },
})
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
      for (const link of orgLinks) {
        await client.join(`org:${link.organizationId}`);
      }

      (client.data as SocketData).userId = payload.sub;
    } catch {
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

  /**
   * Avisa todas as abas abertas de que um dado de domínio mudou, para que elas
   * recarreguem sozinhas em vez de depender de F5 ou do polling de 60s.
   *
   * Vai para todo mundo (sem room) de propósito: o payload é só o tipo do
   * evento e o id da entidade — uma dica de "recarregue o que está na tela",
   * não o dado em si. Quem recebe continua enxergando apenas o que os
   * endpoints autorizam para ele. O adapter Redis replica isto para os demais
   * nós, então uma mudança feita em Campinas atualiza a tela aberta em Limeira.
   */
  broadcastDataChanged(eventType: string, entityId: string) {
    this.server.emit('data:changed', { eventType, entityId });
  }

  /**
   * Quem está com o chat aberto entra na room da conversa. É isso que permite
   * ao ChatService saber quem já está vendo a mensagem chegar na tela e não
   * precisa de alerta no sino.
   *
   * A participação é conferida: entrar na room de uma conversa alheia não
   * vazaria mensagem (a room só serve para suprimir aviso), mas suprimiria o
   * alerta de quem tem direito a ele.
   */
  @SubscribeMessage('conversation:open')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async handleConversationOpen(@ConnectedSocket() client: Socket, @MessageBody() body: ConversationRoomDto) {
    const userId = (client.data as Partial<SocketData>).userId;
    if (!userId) return { ok: false, code: 'UNAUTHENTICATED' };

    try {
      await this.chatService.assertCanViewConversation(userId, body.conversationId);
      await client.join(`conv:${body.conversationId}`);
      return { ok: true };
    } catch {
      return { ok: false, code: 'FORBIDDEN_CONVERSATION_ACCESS' };
    }
  }

  @SubscribeMessage('conversation:close')
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  async handleConversationClose(@ConnectedSocket() client: Socket, @MessageBody() body: ConversationRoomDto) {
    await client.leave(`conv:${body.conversationId}`);
    return { ok: true };
  }

  /**
   * Quem está com esta conversa aberta neste instante, em qualquer nó —
   * `fetchSockets` passa pelo adapter Redis, então alcança as abas conectadas
   * nas outras instâncias da API.
   */
  async findUserIdsViewingConversation(conversationId: string): Promise<Set<string>> {
    const sockets = await this.server.in(`conv:${conversationId}`).fetchSockets();
    const userIds = sockets
      .map((socket) => (socket.data as Partial<SocketData>).userId)
      .filter((userId): userId is string => !!userId);
    return new Set(userIds);
  }

  /**
   * Responde com ack ({ok}) em vez de silêncio: sem isso, um envio que falhava
   * (sem permissão, conversa inexistente, validação) sumia — o cliente já tinha
   * limpado o campo de texto e a mensagem se perdia sem aviso.
   */
  @SubscribeMessage('message:send')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  async handleMessageSend(@ConnectedSocket() client: Socket, @MessageBody() body: SendMessageWsDto) {
    const userId = (client.data as Partial<SocketData>).userId;
    if (!userId) return { ok: false, code: 'UNAUTHENTICATED' };

    try {
      const message = await this.chatService.sendMessage(userId, body.conversationId, body.body);
      return { ok: true, messageId: message.id };
    } catch (err) {
      this.logger.warn(`Falha ao enviar mensagem via WS (usuário ${userId}): ${(err as Error).message}`);
      return { ok: false, code: 'MESSAGE_NOT_SENT' };
    }
  }
}
