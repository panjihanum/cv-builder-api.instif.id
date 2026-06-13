import { z } from "zod";

function loadDotEnvIfPresent(): void {
  try {
    process.loadEnvFile();
  } catch {
    return;
  }
}

loadDotEnvIfPresent();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3011),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:3010"),
  ENCRYPTION_KEY: z.string().min(1),
  WA_GATEWAY_URL: z.string().min(1).default("http://127.0.0.1:4100"),
  WA_GATEWAY_SECRET: z.string().min(1),
});

export const env = envSchema.parse(process.env);
