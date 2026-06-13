import { Hono } from "hono";
import { z } from "zod";
import { validate } from "@/lib/validation.js";
import { requireAuth, type AuthEnv } from "@/middleware/requireAuth.js";
import * as authService from "@/services/auth.service.js";

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

const requestOtpSchema = z.object({
  phone: z.string().min(8),
});

const verifyOtpSchema = z.object({
  phone: z.string().min(8),
  code: z.string().length(6),
  name: z.string().min(1).optional(),
});

export const authRoutes = new Hono<AuthEnv>();

authRoutes.post("/register", validate("json", registerSchema), async (c) => {
  const result = await authService.register(c.req.valid("json"));
  return c.json(result);
});

authRoutes.post("/login", validate("json", loginSchema), async (c) => {
  const result = await authService.login(c.req.valid("json"));
  return c.json(result);
});

authRoutes.post(
  "/request-otp",
  validate("json", requestOtpSchema),
  async (c) => {
    const { phone } = c.req.valid("json");
    const result = await authService.requestPhoneOtp(phone);
    return c.json(result);
  }
);

authRoutes.post("/verify-otp", validate("json", verifyOtpSchema), async (c) => {
  const result = await authService.verifyPhoneOtp(c.req.valid("json"));
  return c.json(result);
});

authRoutes.get("/me", requireAuth, async (c) => {
  const user = await authService.getMe(c.get("user").sub);
  return c.json({ user });
});

authRoutes.post("/logout", requireAuth, (c) => c.json({ ok: true }));
