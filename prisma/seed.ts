import bcryptjs from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const ADMIN_EMAIL = "admin@instif.id";
const DEV_ADMIN_PASSWORD = "admin123";

const defaultSettings: Record<string, string> = {
  "pricing.packPrice": "10000",
  "pricing.creditsPerPack": "15",
  "anthropic.model": "claude-opus-4-8",
  "duitku.env": "sandbox",
};

async function seedAdmin() {
  const password = process.argv[2] ?? DEV_ADMIN_PASSWORD;
  const hashed = await bcryptjs.hash(password, 10);
  await db.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { role: "ADMIN" },
    create: {
      name: "Admin",
      email: ADMIN_EMAIL,
      password: hashed,
      role: "ADMIN",
      credit: { create: {} },
    },
  });
}

async function seedSettings() {
  for (const [key, value] of Object.entries(defaultSettings)) {
    await db.setting.upsert({
      where: { key },
      update: {},
      create: { key, value, encrypted: false },
    });
  }
}

async function main() {
  await seedAdmin();
  await seedSettings();
  console.log("Seed selesai: admin default dan settings default dibuat");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
