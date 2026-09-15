-- CreateEnum
CREATE TYPE "UserTokenPurpose" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

-- CreateEnum
CREATE TYPE "DonationRecurrence" AS ENUM ('DAILY', 'WEEKDAYS', 'WEEKLY');

-- AlterTable
ALTER TABLE "donation_items" ADD COLUMN     "allergens" TEXT,
ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "completedPickupCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "noShowCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notificationCategories" "DonationCategory"[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "deactivatedReason" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "user_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "UserTokenPurpose" NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donation_templates" (
    "id" TEXT NOT NULL,
    "donorOrganizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "allowPartial" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "items" JSONB NOT NULL,
    "recurrence" "DonationRecurrence" NOT NULL,
    "hourOfDay" INTEGER NOT NULL,
    "weekday" INTEGER,
    "pickupWindowHours" INTEGER NOT NULL DEFAULT 4,
    "expiresInHours" INTEGER NOT NULL DEFAULT 8,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastGeneratedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donation_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_tokens_tokenHash_key" ON "user_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "user_tokens_userId_purpose_idx" ON "user_tokens"("userId", "purpose");

-- CreateIndex
CREATE INDEX "donation_templates_donorOrganizationId_idx" ON "donation_templates"("donorOrganizationId");

-- CreateIndex
CREATE INDEX "donation_templates_isActive_idx" ON "donation_templates"("isActive");

-- AddForeignKey
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donation_templates" ADD CONSTRAINT "donation_templates_donorOrganizationId_fkey" FOREIGN KEY ("donorOrganizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

