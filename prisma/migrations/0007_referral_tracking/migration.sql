-- AlterTable: add referredBy to users
ALTER TABLE "users" ADD COLUMN "referredBy" TEXT;

-- AlterTable: add refCode to orders
ALTER TABLE "orders" ADD COLUMN "refCode" TEXT;
