-- CreateTable
CREATE TABLE "User" (
    "userID" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "visibleName" TEXT,
    "password" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("userID")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_userID_key" ON "User"("userID");

-- CreateIndex
CREATE UNIQUE INDEX "User_userName_key" ON "User"("userName");
