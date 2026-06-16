import { randomBytes } from "node:crypto";
import { vi } from "vitest";

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET ??= "test-jwt-secret";
process.env.ENCRYPTION_KEY ??= `base64:${randomBytes(32).toString("base64")}`;
process.env.CORS_ORIGIN ??= "http://localhost:3010";
process.env.WA_GATEWAY_URL ??= "http://127.0.0.1:4100";
process.env.WA_GATEWAY_SECRET ??= "test-wa-gateway-secret";

function createModelMock() {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  };
}

vi.mock("@/lib/db.js", () => {
  const db = {
    user: createModelMock(),
    cv: createModelMock(),
    credit: createModelMock(),
    order: createModelMock(),
    setting: createModelMock(),
    otpCode: createModelMock(),
    whatsAppSession: createModelMock(),
    aiUsageLog: createModelMock(),
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: typeof db) => Promise<unknown>)(db);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
  return { db };
});
