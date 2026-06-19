import bcryptjs from "bcryptjs";
import { db } from "@/lib/db.js";
import { signToken } from "@/lib/jwt.js";
import { verifySSOToken } from "@/lib/sso.js";
import { HttpError } from "@/lib/httpError.js";
import { normalizePhone } from "@/lib/phone.js";
import * as waGateway from "@/lib/waGateway.js";
import { isEmailConfigured, sendVerificationEmail } from "@/lib/email.js";
import {
  consumeVerificationToken,
  createVerificationToken,
} from "@/lib/verification.js";

const BCRYPT_ROUNDS = 10;

export interface PublicUser {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
}

interface UserRecord {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
}

function toPublicUser(user: UserRecord): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  };
}

async function createAuthResult(user: UserRecord) {
  const token = await signToken({
    sub: user.id,
    email: user.email ?? "",
    role: user.role,
  });
  return { token, user: toPublicUser(user) };
}

export interface RegisterResult {
  pendingVerification: true;
  email: string;
}

/**
 * Registers a member with email + password. The account stays unverified
 * (`emailVerified = null`) and a verification link is emailed — login is blocked
 * until the link is clicked. Email delivery is required, so we refuse with 503
 * when SMTP isn't configured rather than create an account nobody can activate.
 */
export async function register(input: {
  name: string;
  email: string;
  password: string;
}): Promise<RegisterResult> {
  const email = input.email.trim().toLowerCase();
  if (!(await isEmailConfigured())) {
    throw new HttpError(
      503,
      "Pendaftaran email belum aktif. Hubungi admin atau masuk dengan nomor HP."
    );
  }
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    throw new HttpError(400, "Email sudah terdaftar");
  }
  const password = await bcryptjs.hash(input.password, BCRYPT_ROUNDS);
  await db.user.create({
    data: {
      name: input.name.trim(),
      email,
      password,
      credit: { create: {} },
    },
  });
  const token = await createVerificationToken(email);
  await sendVerificationEmail(email, token);
  return { pendingVerification: true, email };
}

export async function login(input: { email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.password) {
    throw new HttpError(401, "Email atau password salah");
  }
  const passwordValid = await bcryptjs.compare(input.password, user.password);
  if (!passwordValid) {
    throw new HttpError(401, "Email atau password salah");
  }
  if (!user.emailVerified) {
    throw new HttpError(
      403,
      "Email belum diverifikasi. Cek inbox kamu untuk tautan verifikasi."
    );
  }
  if (user.status !== "ACTIVE") {
    throw new HttpError(403, "Akun tidak aktif");
  }
  return createAuthResult(user);
}

/**
 * Marks an account verified from a token. Returns a coarse status the route can
 * map to a friendly redirect — it never reveals which email was involved.
 */
export async function verifyEmail(
  token: string
): Promise<"success" | "expired" | "invalid"> {
  const result = await consumeVerificationToken(token);
  if (result.status !== "valid") return result.status;
  await db.user.updateMany({
    where: { email: result.email, emailVerified: null },
    data: { emailVerified: new Date() },
  });
  return "success";
}

/**
 * Re-sends the verification email. Always resolves to `{ ok: true }` regardless
 * of whether the email exists, so the endpoint can't be used to enumerate
 * accounts. No-op for unknown or already-verified emails.
 */
export async function resendVerification(
  rawEmail: string
): Promise<{ ok: true }> {
  const email = rawEmail.trim().toLowerCase();
  if (await isEmailConfigured()) {
    const user = await db.user.findUnique({ where: { email } });
    if (user && user.password && !user.emailVerified) {
      const token = await createVerificationToken(email);
      await sendVerificationEmail(email, token);
    }
  }
  return { ok: true };
}

export async function requestPhoneOtp(phone: string): Promise<{ ok: true }> {
  await waGateway.requestOtp(normalizePhone(phone), "LOGIN");
  return { ok: true };
}

export async function verifyPhoneOtp(input: {
  phone: string;
  code: string;
  name?: string;
  referredBy?: string;
}) {
  const phone = normalizePhone(input.phone);
  await waGateway.verifyOtp(phone, input.code);

  let user = await db.user.findUnique({ where: { phone } });
  if (!user) {
    const ref = input.referredBy?.replace(/^@/, "").trim() || null;
    user = await db.user.create({
      data: {
        name: input.name?.trim() || `User ${phone.slice(-4)}`,
        phone,
        referredBy: ref,
        credit: { create: {} },
      },
    });
  }
  if (user.status !== "ACTIVE") {
    throw new HttpError(403, "Akun tidak aktif");
  }
  return createAuthResult(user);
}

/**
 * Exchanges a hub-issued SSO token for a local admin session. The hub only
 * signs tokens for its own ADMIN users, so a valid token grants access to the
 * first active local ADMIN account.
 */
export async function ssoLogin(ssoToken: string) {
  const payload = verifySSOToken(ssoToken);
  if (!payload) {
    throw new HttpError(401, "Token SSO tidak valid atau kadaluarsa");
  }
  const admin = await db.user.findFirst({
    where: { role: "ADMIN", status: "ACTIVE" },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    throw new HttpError(404, "Akun admin tidak ditemukan");
  }
  return createAuthResult(admin);
}

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError(404, "User tidak ditemukan");
  }
  return toPublicUser(user);
}

export async function updateMe(
  userId: string,
  input: { name?: string; email?: string | null }
): Promise<PublicUser> {
  if (input.email) {
    const conflict = await db.user.findFirst({
      where: { email: input.email, NOT: { id: userId } },
    });
    if (conflict) throw new HttpError(400, "Email sudah dipakai akun lain");
  }
  const user = await db.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.email !== undefined && { email: input.email }),
    },
  });
  return toPublicUser(user);
}

export async function changePassword(
  userId: string,
  input: { currentPassword: string; newPassword: string }
): Promise<{ ok: true }> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "User tidak ditemukan");
  if (!user.password)
    throw new HttpError(400, "Akun ini tidak menggunakan password");
  const valid = await bcryptjs.compare(input.currentPassword, user.password);
  if (!valid) throw new HttpError(400, "Password saat ini salah");
  const hashed = await bcryptjs.hash(input.newPassword, BCRYPT_ROUNDS);
  await db.user.update({ where: { id: userId }, data: { password: hashed } });
  return { ok: true };
}
