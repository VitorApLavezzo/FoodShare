import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

// Classe (não interface): o ValidationPipe só valida se houver metadado de tipo
// em runtime — com um type TS o payload do WebSocket entrava sem validação
// nenhuma, aceitando mensagem de qualquer tamanho.
export class SendMessageWsDto {
  @IsUUID()
  conversationId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  body!: string;
}
