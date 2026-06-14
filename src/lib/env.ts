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
  WA_GATEWAY_SECRET: z.string().min(1).default(""),
  /** Multiple gateways with failover: "url1|secret1,url2|secret2". Overrides WA_GATEWAY_URL/SECRET. */
  WA_GATEWAYS: z.string().optional(),
  /** Shared HMAC secret with the instif.id hub for admin SSO. Empty = SSO disabled. */
  SSO_SECRET: z.string().optional(),
  /** Public API origin used to build gateway webhook URLs. Falls back to the request origin. */
  PUBLIC_API_URL: z.string().optional(),
  /** Public app URL users return to after paying. Falls back to the first CORS origin. */
  PUBLIC_APP_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);
