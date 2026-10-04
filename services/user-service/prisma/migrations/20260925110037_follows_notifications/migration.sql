-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('FOLLOW', 'REPLY', 'MENTION');

-- CreateTable
CREATE TABLE "Follow" (
    "followerID" TEXT NOT NULL,
    "followeeID" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("followerID","followeeID")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientID" TEXT NOT NULL,
    "actorID" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "postID" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Follow_followeeID_idx" ON "Follow"("followeeID");

-- CreateIndex
CREATE INDEX "Notification_recipientID_createdAt_idx" ON "Notification"("recipientID", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_recipientID_readAt_idx" ON "Notification"("recipientID", "readAt");

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerID_fkey" FOREIGN KEY ("followerID") REFERENCES "User"("userID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followeeID_fkey" FOREIGN KEY ("followeeID") REFERENCES "User"("userID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientID_fkey" FOREIGN KEY ("recipientID") REFERENCES "User"("userID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_actorID_fkey" FOREIGN KEY ("actorID") REFERENCES "User"("userID") ON DELETE CASCADE ON UPDATE CASCADE;
