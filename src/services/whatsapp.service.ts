import QRCode from "qrcode";
import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import { WHATSAPP_AUTH_PATH, WHATSAPP_CLIENT_ID } from "@/config/whatsapp.js";

export type WhatsAppStatus = "DISCONNECTED" | "QR_PENDING" | "CONNECTED";

interface WhatsAppClient {
  initialize(): Promise<void>;
  sendMessage(chatId: string, content: string): Promise<unknown>;
  logout(): Promise<void>;
  destroy(): Promise<void>;
  on(event: string, listener: (payload: string) => void): unknown;
}

let client: WhatsAppClient | null = null;
let status: WhatsAppStatus = "DISCONNECTED";
let lastQr: string | null = null;

async function safely(action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch {
    return;
  }
}

async function persistStatus(nextStatus: WhatsAppStatus): Promise<void> {
  status = nextStatus;
  await safely(async () => {
    const existing = await db.whatsAppSession.findFirst();
    if (existing) {
      await db.whatsAppSession.update({
        where: { id: existing.id },
        data: { status: nextStatus },
      });
    } else {
      await db.whatsAppSession.create({ data: { status: nextStatus } });
    }
  });
}

async function createClient(): Promise<WhatsAppClient> {
  const { Client, LocalAuth } = await import("whatsapp-web.js");
  const instance = new Client({
    authStrategy: new LocalAuth({
      clientId: WHATSAPP_CLIENT_ID,
      dataPath: WHATSAPP_AUTH_PATH,
    }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });
  instance.on("qr", (qr: string) => {
    lastQr = qr;
    void persistStatus("QR_PENDING");
  });
  instance.on("ready", () => {
    lastQr = null;
    void persistStatus("CONNECTED");
  });
  instance.on("disconnected", () => {
    lastQr = null;
    void persistStatus("DISCONNECTED");
  });
  void instance.initialize();
  return instance as unknown as WhatsAppClient;
}

export async function ensureClient(): Promise<void> {
  if (!client) {
    client = await createClient();
  }
}

export function getStatus(): WhatsAppStatus {
  return status;
}

export async function getQrDataUrl(): Promise<{
  qr: string | null;
  status: WhatsAppStatus;
}> {
  await ensureClient();
  if (!lastQr) {
    return { qr: null, status };
  }
  const qr = await QRCode.toDataURL(lastQr);
  return { qr, status };
}

export function formatPhoneToChatId(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  return `${normalized}@c.us`;
}

export async function sendMessage(
  phone: string,
  message: string
): Promise<void> {
  if (!client || status !== "CONNECTED") {
    throw new HttpError(
      503,
      "WhatsApp belum terhubung, scan QR di halaman admin whatsapp"
    );
  }
  await client.sendMessage(formatPhoneToChatId(phone), message);
}

export async function logout(): Promise<void> {
  const current = client;
  client = null;
  lastQr = null;
  if (current) {
    await safely(() => current.logout());
    await safely(() => current.destroy());
  }
  await persistStatus("DISCONNECTED");
}
