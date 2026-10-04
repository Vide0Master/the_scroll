-- CreateTable
CREATE TABLE "PostTag" (
    "postID" TEXT NOT NULL,
    "tag" TEXT NOT NULL,

    CONSTRAINT "PostTag_pkey" PRIMARY KEY ("postID","tag")
);

-- CreateTable
CREATE TABLE "PostMention" (
    "postID" TEXT NOT NULL,
    "userID" TEXT NOT NULL,
    "userName" TEXT NOT NULL,

    CONSTRAINT "PostMention_pkey" PRIMARY KEY ("postID","userID")
);

-- CreateIndex
CREATE INDEX "PostTag_tag_idx" ON "PostTag"("tag");

-- AddForeignKey
ALTER TABLE "PostTag" ADD CONSTRAINT "PostTag_postID_fkey" FOREIGN KEY ("postID") REFERENCES "Post"("postID") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostMention" ADD CONSTRAINT "PostMention_postID_fkey" FOREIGN KEY ("postID") REFERENCES "Post"("postID") ON DELETE CASCADE ON UPDATE CASCADE;
