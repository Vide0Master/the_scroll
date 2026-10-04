-- AlterTable
ALTER TABLE "User" ADD COLUMN     "banReason" TEXT,
ADD COLUMN     "bannedAt" TIMESTAMP(3),
ADD COLUMN     "bannedByID" TEXT;

-- CreateTable
CREATE TABLE "BlockedEmail" (
    "email" TEXT NOT NULL,
    "reason" TEXT,
    "blockedByID" TEXT NOT NULL,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlockedEmail_pkey" PRIMARY KEY ("email")
);
