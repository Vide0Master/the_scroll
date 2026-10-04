-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "parentPostID" TEXT;

-- CreateIndex
CREATE INDEX "Post_parentPostID_idx" ON "Post"("parentPostID");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_parentPostID_fkey" FOREIGN KEY ("parentPostID") REFERENCES "Post"("postID") ON DELETE SET NULL ON UPDATE CASCADE;
