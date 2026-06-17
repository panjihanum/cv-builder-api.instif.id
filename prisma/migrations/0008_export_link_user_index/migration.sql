-- CreateTable
CREATE TABLE IF NOT EXISTS "export_links" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cvTitle" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "export_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "export_links_expiresAt_idx" ON "export_links"("expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "export_links_userId_createdAt_idx" ON "export_links"("userId", "createdAt" DESC);
