-- DonationCategory passa de oito valores para três (preparados, industrializados,
-- naturais). Postgres não remove valor de enum, então o tipo é recriado e cada
-- coluna convertida com o mapeamento abaixo:
--   PREPARED_MEALS                      -> PREPARED_MEALS
--   FRUITS | VEGETABLES | LEGUMES       -> NATURAL_FOODS
--   PACKAGED_GOODS | BAKERY | BEVERAGES -> PACKAGED_GOODS  (industrializados)
--   OTHER                               -> PACKAGED_GOODS  (destino do resto)
CREATE TYPE "DonationCategory_new" AS ENUM ('PREPARED_MEALS', 'PACKAGED_GOODS', 'NATURAL_FOODS');

ALTER TABLE "donation_items"
  ALTER COLUMN "category" TYPE "DonationCategory_new"
  USING (
    CASE "category"::text
      WHEN 'PREPARED_MEALS' THEN 'PREPARED_MEALS'
      WHEN 'FRUITS' THEN 'NATURAL_FOODS'
      WHEN 'VEGETABLES' THEN 'NATURAL_FOODS'
      WHEN 'LEGUMES' THEN 'NATURAL_FOODS'
      ELSE 'PACKAGED_GOODS'
    END
  )::"DonationCategory_new";

-- Os itens de molde (donation_templates.items) são JSONB, não coluna enum: o
-- mesmo mapeamento precisa ser aplicado dentro do documento, senão o molde
-- continua gerando doação com categoria que não existe mais.
UPDATE "donation_templates"
SET "items" = COALESCE(
  (
    SELECT jsonb_agg(
      CASE
        WHEN item->>'category' IN ('FRUITS', 'VEGETABLES', 'LEGUMES')
          THEN jsonb_set(item, '{category}', '"NATURAL_FOODS"')
        WHEN item->>'category' IN ('BAKERY', 'BEVERAGES', 'OTHER')
          THEN jsonb_set(item, '{category}', '"PACKAGED_GOODS"')
        ELSE item
      END
    )
    FROM jsonb_array_elements("items") AS item
  ),
  '[]'::jsonb
)
WHERE jsonb_typeof("items") = 'array';

-- Coluna de array: Postgres não aceita subquery no USING de um ALTER COLUMN,
-- então o remapeamento passa por text[] e volta ao enum. O DISTINCT evita
-- deixar a mesma categoria repetida — o mapeamento colapsa valores (as três
-- categorias naturais viram uma só).
ALTER TABLE "organizations"
  ALTER COLUMN "notificationCategories" DROP DEFAULT,
  ALTER COLUMN "notificationCategories" TYPE text[] USING "notificationCategories"::text[];

UPDATE "organizations"
SET "notificationCategories" = COALESCE(
  (
    SELECT array_agg(DISTINCT
      CASE c
        WHEN 'PREPARED_MEALS' THEN 'PREPARED_MEALS'
        WHEN 'FRUITS' THEN 'NATURAL_FOODS'
        WHEN 'VEGETABLES' THEN 'NATURAL_FOODS'
        WHEN 'LEGUMES' THEN 'NATURAL_FOODS'
        ELSE 'PACKAGED_GOODS'
      END
    )
    FROM unnest("notificationCategories") AS c
  ),
  '{}'::text[]
);

ALTER TABLE "organizations"
  ALTER COLUMN "notificationCategories" TYPE "DonationCategory_new"[]
  USING "notificationCategories"::"DonationCategory_new"[];

DROP TYPE "DonationCategory";
ALTER TYPE "DonationCategory_new" RENAME TO "DonationCategory";
