-- CreateTable
CREATE TABLE "PostLike" (
    "postID" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostLike_pkey" PRIMARY KEY ("postID","userID")
);

-- CreateTable
CREATE TABLE "PostView" (
    "postID" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostView_pkey" PRIMARY KEY ("postID","userID")
);

-- CreateIndex
CREATE INDEX "PostLike_createdAt_idx" ON "PostLike"("createdAt");

-- CreateIndex
CREATE INDEX "PostView_createdAt_idx" ON "PostView"("createdAt");

-- AddForeignKey
ALTER TABLE "PostLike" ADD CONSTRAINT "PostLike_postID_fkey" FOREIGN KEY ("postID") REFERENCES "Post"("postID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostView" ADD CONSTRAINT "PostView_postID_fkey" FOREIGN KEY ("postID") REFERENCES "Post"("postID") ON DELETE CASCADE ON UPDATE CASCADE;
