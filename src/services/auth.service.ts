import bcryptjs from "bcryptjs";
import { db } from "@/lib/db.js";
import { signToken } from "@/lib/jwt.js";
import { verifySSOToken } from "@/lib/sso.js";
import { HttpError } from "@/lib/httpError.js";
import { normalizePhone } from "@/lib/phone.js";
import * as waGateway from "@/lib/waGateway.js";

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

export async function register(input: {
  name: string;
  email: string;
  password: string;
}) {
  const existing = await db.user.findUnique({
    where: { email: input.email },
  });
  if (existing) {
    throw new HttpError(400, "Email sudah terdaftar");
  }
  const password = await bcryptjs.hash(input.password, BCRYPT_ROUNDS);
  const user = await db.user.create({
    data: {
      name: input.name,
      email: input.email,
      password,
      credit: { create: {} },
    },
  });
  return createAuthResult(user);
}

export async function login(input: { email: string; password: string }) {
  const user = await db.user.findUnique({ where: { email: input.email } });
  if (!user || !user.password) {
    throw new HttpError(401, "Email atau password salah");
  }
  const passwordValid = await bcryptjs.compare(input.password, user.password);
  if (!passwordValid) {
    throw new HttpError(401, "Email atau password salah");
  }
  if (user.status !== "ACTIVE") {
    throw new HttpError(403, "Akun tidak aktif");
  }
  return createAuthResult(user);
}

export async function requestPhoneOtp(phone: string): Promise<{ ok: true }> {
  await waGateway.requestOtp(normalizePhone(phone), "LOGIN");
  return { ok: true };
}

export async function verifyPhoneOtp(input: {
  phone: string;
  code: string;
  name?: string;
}) {
  const phone = normalizePhone(input.phone);
  await waGateway.verifyOtp(phone, input.code);

  let user = await db.user.findUnique({ where: { phone } });
  if (!user) {
    user = await db.user.create({
      data: {
        name: input.name?.trim() || `User ${phone.slice(-4)}`,
        phone,
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
