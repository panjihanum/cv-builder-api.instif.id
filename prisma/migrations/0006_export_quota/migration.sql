-- CreateTable
CREATE TABLE "export_quotas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "freeDailyUsed" INTEGER NOT NULL DEFAULT 0,
    "freeDailyReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "packExports" INTEGER NOT NULL DEFAULT 0,
    "packExpiresAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "export_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "export_quotas_userId_key" ON "export_quotas"("userId");

-- AddForeignKey
ALTER TABLE "export_quotas" ADD CONSTRAINT "export_quotas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
