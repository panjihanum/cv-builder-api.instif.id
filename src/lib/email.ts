import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env.js";
import { getSetting } from "@/services/settings.service.js";

/**
 * SMTP email sending. All configuration lives in the admin dashboard
 * (Pengaturan → Email / SMTP) and is resolved at call time — the password is
 * stored encrypted at rest and decrypted by `getSetting`.
 *
 * Admins can verify the connection from the dashboard via
 * `POST /admin/smtp/test`, which calls `verifySmtpConnection()`.
 */

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  isConfigured: boolean;
}

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const [host, port, secure, user, pass, fromEmail, fromName] =
    await Promise.all([
      getSetting("smtp.host"),
      getSetting("smtp.port"),
      getSetting("smtp.secure"),
      getSetting("smtp.user"),
      getSetting("smtp.pass"),
      getSetting("smtp.fromEmail"),
      getSetting("smtp.fromName"),
    ]);
  const parsedPort = Number(port);
  return {
    host: host ?? "",
    port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 587,
    secure: secure === "true",
    user: user ?? "",
    pass: pass ?? "",
    fromEmail: fromEmail ?? "",
    fromName: fromName ?? "",
    isConfigured: Boolean(host && user && pass),
  };
}

function buildTransport(cfg: SmtpConfig): Transporter {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure, // true for 465, false for 587/STARTTLS
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

function fromHeader(cfg: SmtpConfig): string {
  const email = cfg.fromEmail || cfg.user;
  return cfg.fromName ? `"${cfg.fromName}" <${email}>` : email;
}

/** Public app URL members return to (verification redirect target). */
export function appBaseUrl(): string {
  const base = env.PUBLIC_APP_URL || env.CORS_ORIGIN.split(",")[0] || "";
  return base.replace(/\/+$/, "");
}

/** Public API URL used to build the clickable verification link. */
export function apiBaseUrl(): string {
  const base = env.PUBLIC_API_URL || `http://localhost:${env.PORT}`;
  return base.replace(/\/+$/, "");
}

export type SmtpTestResult = { ok: boolean; error?: string };

/**
 * Verify the SMTP connection + credentials without sending mail. Used by the
 * dashboard "cek SMTP" button so admins know whether email is actually live.
 */
export async function verifySmtpConnection(): Promise<SmtpTestResult> {
  const cfg = await getSmtpConfig();
  if (!cfg.isConfigured) {
    return {
      ok: false,
      error: "SMTP belum dikonfigurasi (host/user/password)",
    };
  }
  try {
    await buildTransport(cfg).verify();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Koneksi SMTP gagal",
    };
  }
}

/** Send a single email. Throws if SMTP isn't configured or the send fails. */
export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  const cfg = await getSmtpConfig();
  if (!cfg.isConfigured) {
    throw new Error("SMTP belum dikonfigurasi");
  }
  await buildTransport(cfg).sendMail({
    from: fromHeader(cfg),
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

/** Whether email sending is currently possible (drives register behaviour). */
export async function isEmailConfigured(): Promise<boolean> {
  return (await getSmtpConfig()).isConfigured;
}

const BRAND = "Instif CV Builder";

/** Send the account email-verification link. */
export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<void> {
  const link = `${apiBaseUrl()}/auth/verify-email?token=${encodeURIComponent(token)}`;
  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;color:#1c1917">
    <h2 style="color:#09090b;margin-bottom:4px">Verifikasi email kamu</h2>
    <p>Terima kasih sudah mendaftar di <strong>${BRAND}</strong>. Klik tombol di bawah untuk mengaktifkan akunmu.</p>
    <p style="margin:24px 0">
      <a href="${link}" style="background:#09090b;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;display:inline-block">Verifikasi Email</a>
    </p>
    <p style="font-size:13px;color:#78716c">Atau buka tautan ini:<br/><a href="${link}" style="color:#0a0a0a">${link}</a></p>
    <p style="font-size:13px;color:#78716c">Tautan berlaku 24 jam. Abaikan email ini jika kamu tidak mendaftar.</p>
  </div>`;
  await sendMail({
    to,
    subject: `Verifikasi email — ${BRAND}`,
    html,
    text: `Verifikasi email kamu di ${BRAND}: ${link}`,
  });
}
