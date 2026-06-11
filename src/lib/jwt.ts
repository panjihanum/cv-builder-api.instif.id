import * as jose from "jose";
import { env } from "@/lib/env.js";

const secret = new TextEncoder().encode(env.JWT_SECRET);
const expiresIn = "7d";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new jose.SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jose.jwtVerify(token, secret);
  return payload as unknown as JwtPayload;
}
