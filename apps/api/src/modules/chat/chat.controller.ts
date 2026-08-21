import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { CurrentUser, type AuthenticatedUser } from '../auth/decorators/current-user.decorator';

@ApiTags('chat')
@ApiBearerAuth()
@Controller()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('conversations')
  @ApiOperation({ summary: 'Lista as conversas (doador<->ONG) do usuário atual.' })
  findConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.chatService.findConversations(user.id);
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Histórico de mensagens de uma conversa (fallback de reconexão).' })
  findMessages(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.chatService.findMessages(user.id, id);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Envia uma mensagem (fallback REST; o caminho principal é via WebSocket).' })
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.chatService.sendMessage(user.id, id, dto.body);
  }
}
