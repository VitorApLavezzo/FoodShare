/*
  Warnings:

  - You are about to drop the column `donationId` on the `audit_logs` table. All the data in the column will be lost.
  - You are about to drop the column `donationId` on the `reservations` table. All the data in the column will be lost.
  - You are about to drop the `donations` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `donationListId` to the `reservations` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DonationListStatus" AS ENUM ('OPEN', 'FULLY_RESERVED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DonationItemStatus" AS ENUM ('AVAILABLE', 'FULLY_RESERVED', 'CANCELLED');

-- DropForeignKey
ALTER TABLE "audit_logs" DROP CONSTRAINT "audit_logs_donationId_fkey";

-- DropForeignKey
ALTER TABLE "donations" DROP CONSTRAINT "donations_donorOrganizationId_fkey";

-- DropForeignKey
ALTER TABLE "reservations" DROP CONSTRAINT "reservations_donationId_fkey";

-- DropIndex
DROP INDEX "reservations_donationId_idx";

-- AlterTable
ALTER TABLE "audit_logs" DROP COLUMN "donationId",
ADD COLUMN     "donationListId" TEXT;

-- AlterTable
ALTER TABLE "reservations" DROP COLUMN "donationId",
ADD COLUMN     "donationListId" TEXT NOT NULL;

-- DropTable
DROP TABLE "donations";

-- DropEnum
DROP TYPE "DonationStatus";

-- CreateTable
CREATE TABLE "donation_lists" (
    "id" TEXT NOT NULL,
    "donorOrganizationId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "allowPartial" BOOLEAN NOT NULL DEFAULT true,
    "status" "DonationListStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "pickupDeadline" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "donation_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_items" (
    "id" TEXT NOT NULL,
    "donationListId" TEXT NOT NULL,
    "foodName" TEXT NOT NULL,
    "category" "DonationCategory" NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "remainingQuantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "batch" TEXT,
    "storageCondition" TEXT,
    "status" "DonationItemStatus" NOT NULL DEFAULT 'AVAILABLE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_items" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "donationItemId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "reservation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "donationListId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "donation_lists_status_idx" ON "donation_lists"("status");

-- CreateIndex
CREATE INDEX "donation_lists_expiresAt_idx" ON "donation_lists"("expiresAt");

-- CreateIndex
CREATE INDEX "donation_lists_nodeId_idx" ON "donation_lists"("nodeId");

-- CreateIndex
CREATE INDEX "donation_items_status_idx" ON "donation_items"("status");

-- CreateIndex
CREATE INDEX "donation_items_category_idx" ON "donation_items"("category");

-- CreateIndex
CREATE INDEX "donation_items_donationListId_idx" ON "donation_items"("donationListId");

-- CreateIndex
CREATE INDEX "reservation_items_reservationId_idx" ON "reservation_items"("reservationId");

-- CreateIndex
CREATE INDEX "reservation_items_donationItemId_idx" ON "reservation_items"("donationItemId");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_reservationId_key" ON "conversations"("reservationId");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "reservations_donationListId_idx" ON "reservations"("donationListId");

-- AddForeignKey
ALTER TABLE "donation_lists" ADD CONSTRAINT "donation_lists_donorOrganizationId_fkey" FOREIGN KEY ("donorOrganizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_items" ADD CONSTRAINT "donation_items_donationListId_fkey" FOREIGN KEY ("donationListId") REFERENCES "donation_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_donationListId_fkey" FOREIGN KEY ("donationListId") REFERENCES "donation_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_items" ADD CONSTRAINT "reservation_items_donationItemId_fkey" FOREIGN KEY ("donationItemId") REFERENCES "donation_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_donationListId_fkey" FOREIGN KEY ("donationListId") REFERENCES "donation_lists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_donationListId_fkey" FOREIGN KEY ("donationListId") REFERENCES "donation_lists"("id") ON DELETE SET NULL ON UPDATE CASCADE;
