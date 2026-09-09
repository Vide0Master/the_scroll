-- CreateTable
CREATE TABLE "Post" (
    "postID" TEXT NOT NULL,
    "authorID" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "media" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("postID")
);

-- CreateTable
CREATE TABLE "Session" (
    "sessionID" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("sessionID")
);

-- CreateIndex
CREATE INDEX "Post_authorID_idx" ON "Post"("authorID");

-- CreateIndex
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Session_userID_idx" ON "Session"("userID");
