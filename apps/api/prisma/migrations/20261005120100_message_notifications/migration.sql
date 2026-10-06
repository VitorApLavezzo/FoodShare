-- Alerta de mensagem nova no chat doador<->ONG.
ALTER TYPE "NotificationType" ADD VALUE 'NEW_MESSAGE' BEFORE 'GENERIC';

-- Guarda a conversa de origem para o sino abrir o chat certo. ON DELETE CASCADE
-- pela mesma razão de donationListId: conversa apagada não deixa alerta órfão.
ALTER TABLE "notifications" ADD COLUMN "conversationId" TEXT;

CREATE INDEX "notifications_conversationId_idx" ON "notifications"("conversationId");

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "conversations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
