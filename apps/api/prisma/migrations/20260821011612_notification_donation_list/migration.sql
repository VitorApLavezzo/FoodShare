-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "donationListId" TEXT;

-- CreateIndex
CREATE INDEX "notifications_donationListId_idx" ON "notifications"("donationListId");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_donationListId_fkey" FOREIGN KEY ("donationListId") REFERENCES "donation_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
