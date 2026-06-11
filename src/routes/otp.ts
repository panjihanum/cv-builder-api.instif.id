import { Hono } from "hono";
import { z } from "zod";
import { validate } from "@/lib/validation.js";
import * as otpService from "@/services/otp.service.js";

const requestOtpSchema = z.object({
  phone: z.string().min(8),
  purpose: z.enum(["VERIFY_PHONE", "LOGIN"]),
});

const verifyOtpSchema = z.object({
  phone: z.string().min(8),
  code: z.string().length(6),
});

export const otpRoutes = new Hono();

otpRoutes.post("/request", validate("json", requestOtpSchema), async (c) => {
  const { phone, purpose } = c.req.valid("json");
  const result = await otpService.requestOtp(phone, purpose);
  return c.json(result);
});

otpRoutes.post("/verify", validate("json", verifyOtpSchema), async (c) => {
  const { phone, code } = c.req.valid("json");
  const result = await otpService.verifyOtp(phone, code);
  return c.json(result);
});
