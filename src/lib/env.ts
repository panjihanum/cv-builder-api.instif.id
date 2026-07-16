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
  /** Shared HMAC secret with the instif.id hub for admin SSO + partner billing. */
  SSO_SECRET: z.string().optional(),
  /** instif.id hub base URL — online payments are routed through its gateway. */
  INSTIF_HUB_URL: z.string().default("https://instif.id"),
  /** Public API origin used to build gateway webhook URLs. Falls back to the request origin. */
  PUBLIC_API_URL: z.string().optional(),
  /** Public app URL users return to after paying. Falls back to the first CORS origin. */
  PUBLIC_APP_URL: z.string().optional(),
  /** WhatsApp number to notify when a payment comes in (e.g. "6285282888755"). */
  NOTIFICATION_PHONE: z.string().optional(),
  /** HMAC secret for generating stateless quick-approve/reject tokens in WA notifications. */
  QUICK_TOKEN_SECRET: z
    .string()
    .min(1)
    .default("change-this-secret-in-production"),
});

/**
 * An unset var and a var set to "" mean the same thing in a .env file, but zod
 * sees "" as a present value and rejects it against `.min(1)` instead of falling
 * back to `.default(...)`. Dropping the empty keys makes `VAR=` behave as "not
 * set", so commenting a value out and blanking it are equivalent.
 */
const presentEnv = Object.fromEntries(
  Object.entries(process.env).filter(([, value]) => value !== "")
);

export const env = envSchema.parse(presentEnv);
