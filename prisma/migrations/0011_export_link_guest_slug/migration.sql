-- Guest (no-login) exports + memorable share slugs.
-- userId becomes nullable so guest exports (no account) can create share links.
ALTER TABLE "export_links" ALTER COLUMN "userId" DROP NOT NULL;

-- Human-friendly public token built from the CV name + a short random code.
ALTER TABLE "export_links" ADD COLUMN "slug" TEXT;

-- Unique so a slug resolves to exactly one link. Postgres allows multiple NULLs,
-- so pre-existing rows (which have no slug) are unaffected.
CREATE UNIQUE INDEX "export_links_slug_key" ON "export_links"("slug");
