-- Prazo de retirada e validade passam a ser de cada item. Os itens que já
-- existem herdam as datas da lista: até aqui eram as mesmas para todos.
ALTER TABLE "donation_items" ADD COLUMN "pickupDeadline" TIMESTAMP(3);
ALTER TABLE "donation_items" ADD COLUMN "expiresAt" TIMESTAMP(3);

UPDATE "donation_items" di
   SET "pickupDeadline" = dl."pickupDeadline",
       "expiresAt" = dl."expiresAt"
  FROM "donation_lists" dl
 WHERE dl.id = di."donationListId";

ALTER TABLE "donation_items" ALTER COLUMN "pickupDeadline" SET NOT NULL;
ALTER TABLE "donation_items" ALTER COLUMN "expiresAt" SET NOT NULL;

CREATE INDEX "donation_items_pickupDeadline_idx" ON "donation_items"("pickupDeadline");

-- Doações recorrentes seguem as mesmas regras da doação manual: retirada com
-- ao menos 24h a partir da publicação e validade ao menos 24h depois dela. Os
-- modelos já cadastrados (padrão antigo de 4h/8h) são ajustados para não
-- publicarem doações que a própria API recusaria.
ALTER TABLE "donation_templates" ALTER COLUMN "pickupWindowHours" SET DEFAULT 24;
ALTER TABLE "donation_templates" ALTER COLUMN "expiresInHours" SET DEFAULT 48;

UPDATE "donation_templates"
   SET "pickupWindowHours" = GREATEST("pickupWindowHours", 24);
UPDATE "donation_templates"
   SET "expiresInHours" = GREATEST("expiresInHours", "pickupWindowHours" + 24);
