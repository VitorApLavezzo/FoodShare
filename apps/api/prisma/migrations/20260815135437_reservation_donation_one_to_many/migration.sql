-- DropIndex
DROP INDEX "reservations_donationId_key";

-- CreateIndex
CREATE INDEX "reservations_donationId_idx" ON "reservations"("donationId");
