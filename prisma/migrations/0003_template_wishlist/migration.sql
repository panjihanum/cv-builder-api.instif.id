-- CreateTable
CREATE TABLE "template_wishlists" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "template_wishlists_templateId_idx" ON "template_wishlists"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "template_wishlists_userId_templateId_key" ON "template_wishlists"("userId", "templateId");

-- AddForeignKey
ALTER TABLE "template_wishlists" ADD CONSTRAINT "template_wishlists_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
