-- AlterEnum
ALTER TYPE "DonationItemStatus" ADD VALUE 'EXPIRED';

-- AlterEnum
ALTER TYPE "DonationListStatus" ADD VALUE 'EXPIRED';

-- AlterEnum
ALTER TYPE "ReservationStatus" ADD VALUE 'EXPIRED';

-- DropForeignKey
ALTER TABLE "messages" DROP CONSTRAINT "messages_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "reservation_items" DROP CONSTRAINT "reservation_items_reservationId_fkey";

-- AlterTable
ALTER TABLE "donation_items" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(12,3),
ALTER COLUMN "remainingQuantity" SET DATA TYPE DECIMAL(12,3);

-- AlterTable
ALTER TABLE "reservation_items" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(12,3);

-- CreateIndex
CREATE INDEX "audit_logs_donationListId_idx" ON "audit_logs"("donationListId");

-- CreateIndex
CREATE INDEX "donation_lists_donorOrganizationId_idx" ON "donation_lists"("donorOrganizationId");

-- CreateIndex
CREATE INDEX "organization_users_userId_idx" ON "organization_users"("userId");

-- CreateIndex
CREATE INDEX "reservations_ngoOrganizationId_idx" ON "reservations"("ngoOrganizationId");

-- AddForeignKey
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

