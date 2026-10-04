-- CreateTable
CREATE TABLE "MediaFile" (
    "fileID" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "ownerID" TEXT,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "isLegacy" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unusedSince" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaFile_pkey" PRIMARY KEY ("fileID")
);

-- CreateTable
CREATE TABLE "MediaUsage" (
    "fileID" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refID" TEXT NOT NULL,

    CONSTRAINT "MediaUsage_pkey" PRIMARY KEY ("fileID","kind","refID")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaFile_storedName_key" ON "MediaFile"("storedName");

-- CreateIndex
CREATE INDEX "MediaFile_unusedSince_idx" ON "MediaFile"("unusedSince");

-- CreateIndex
CREATE INDEX "MediaUsage_kind_refID_idx" ON "MediaUsage"("kind", "refID");

-- AddForeignKey
ALTER TABLE "MediaUsage" ADD CONSTRAINT "MediaUsage_fileID_fkey" FOREIGN KEY ("fileID") REFERENCES "MediaFile"("fileID") ON DELETE CASCADE ON UPDATE CASCADE;
