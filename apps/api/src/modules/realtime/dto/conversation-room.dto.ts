import { IsUUID } from 'class-validator';

// Classe, e não interface, pela mesma razão do SendMessageWsDto: o
// ValidationPipe precisa do metadado de tipo em runtime para validar.
export class ConversationRoomDto {
  @IsUUID()
  conversationId!: string;
}
