import bcryptjs from "bcryptjs";
import { db } from "@/lib/db.js";
import { signToken } from "@/lib/jwt.js";
import { HttpError } from "@/lib/httpError.js";

const BCRYPT_ROUNDS = 10;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
}

function toPublicUser(user: UserRecord): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

async function createAuthResult(user: UserRecord) {
  const token = await signToken({
    sub: user.id,
    email: user.email,
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
  if (!user) {
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

export async function getMe(userId: string): Promise<PublicUser> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new HttpError(404, "User tidak ditemukan");
  }
  return toPublicUser(user);
}
