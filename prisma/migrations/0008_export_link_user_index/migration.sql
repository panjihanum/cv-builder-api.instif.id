-- CreateIndex
CREATE INDEX "export_links_userId_createdAt_idx" ON "export_links"("userId", "createdAt" DESC);
