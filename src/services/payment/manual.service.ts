import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import { paginate, paginationArgs } from "@/lib/pagination.js";
import { getSetting, setSettings } from "@/services/settings.service.js";
import { settleOrderPaid } from "@/services/credit.service.js";

export const MANUAL_TYPES = [
  "bank_transfer",
  "qris",
  "ewallet",
  "virtual_account",
  "other",
] as const;

export type ManualType = (typeof MANUAL_TYPES)[number];

export const manualMethodSchema = z.object({
  id: z.string(),
  type: z.enum(MANUAL_TYPES),
  label: z.string().min(1),
  isActive: z.boolean().default(true),
  instructions: z.string().optional(),
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  accountHolder: z.string().optional(),
  qrImageUrl: z.string().optional(),
  phoneNumber: z.string().optional(),
  extraFields: z.record(z.string(), z.string()).optional(),
});

export type ManualPaymentMethod = z.infer<typeof manualMethodSchema>;

const METHODS_KEY = "manual.methods";

const legacyBankSchema = z.object({
  bankName: z.string(),
  accountNumber: z.string(),
  accountHolder: z.string(),
});

async function readMethods(): Promise<ManualPaymentMethod[]> {
  const raw = await getSetting(METHODS_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return z.array(manualMethodSchema).parse(parsed);
      }
    } catch {
      // fall through to legacy migration
    }
  }
  // One-time migration from old bank.accounts setting
  const legacy = await getSetting("bank.accounts");
  if (legacy) {
    try {
      const accounts = z.array(legacyBankSchema).parse(JSON.parse(legacy));
      if (accounts.length > 0) {
        const migrated: ManualPaymentMethod[] = accounts.map((a) => ({
          id: randomUUID(),
          type: "bank_transfer" as ManualType,
          label: a.bankName,
          isActive: true,
          bankName: a.bankName,
          accountNumber: a.accountNumber,
          accountHolder: a.accountHolder,
        }));
        await saveMethods(migrated);
        return migrated;
      }
    } catch {
      // ignore malformed legacy data
    }
  }
  return [];
}

async function saveMethods(methods: ManualPaymentMethod[]): Promise<void> {
  await setSettings({ [METHODS_KEY]: JSON.stringify(methods) });
}

export async function getActiveMethods(): Promise<ManualPaymentMethod[]> {
  const all = await readMethods();
  return all.filter((m) => m.isActive);
}

export async function getAllMethods(): Promise<ManualPaymentMethod[]> {
  return readMethods();
}

export async function createMethod(
  input: Omit<ManualPaymentMethod, "id">
): Promise<ManualPaymentMethod> {
  const methods = await readMethods();
  const method: ManualPaymentMethod = { id: randomUUID(), ...input };
  methods.push(method);
  await saveMethods(methods);
  return method;
}

export async function updateMethod(
  id: string,
  input: Partial<Omit<ManualPaymentMethod, "id">>
): Promise<ManualPaymentMethod> {
  const methods = await readMethods();
  const idx = methods.findIndex((m) => m.id === id);
  if (idx === -1) throw new HttpError(404, "Metode pembayaran tidak ditemukan");
  methods[idx] = { ...methods[idx], ...input };
  await saveMethods(methods);
  return methods[idx];
}

export async function deleteMethod(id: string): Promise<void> {
  const methods = await readMethods();
  const idx = methods.findIndex((m) => m.id === id);
  if (idx === -1) throw new HttpError(404, "Metode pembayaran tidak ditemukan");
  methods.splice(idx, 1);
  await saveMethods(methods);
}

export async function toggleMethod(id: string): Promise<ManualPaymentMethod> {
  const methods = await readMethods();
  const idx = methods.findIndex((m) => m.id === id);
  if (idx === -1) throw new HttpError(404, "Metode pembayaran tidak ditemukan");
  methods[idx] = { ...methods[idx], isActive: !methods[idx].isActive };
  await saveMethods(methods);
  return methods[idx];
}

export async function reorderMethods(
  orderedIds: string[]
): Promise<ManualPaymentMethod[]> {
  const methods = await readMethods();
  const map = new Map(methods.map((m) => [m.id, m]));
  const reordered: ManualPaymentMethod[] = [];
  for (const id of orderedIds) {
    const m = map.get(id);
    if (m) reordered.push(m);
  }
  // append any methods not in orderedIds at the end
  for (const m of methods) {
    if (!orderedIds.includes(m.id)) reordered.push(m);
  }
  await saveMethods(reordered);
  return reordered;
}

// ---------- payment management (approve / reject) ----------

export async function listPaymentsForAdmin(
  status?: string,
  page = 1,
  pageSize = 20
) {
  const where = status ? { status } : undefined;
  const [items, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...paginationArgs(page, pageSize),
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    db.order.count({ where }),
  ]);
  return paginate(items, total, page, pageSize);
}

export async function approvePayment(orderId: string) {
  await settleOrderPaid(orderId);
  return db.order.findUnique({ where: { id: orderId } });
}

export async function rejectPayment(orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new HttpError(404, "Order tidak ditemukan");
  }
  if (order.status === "PAID") {
    throw new HttpError(400, "Order sudah dibayar, tidak bisa ditolak");
  }
  return db.order.update({
    where: { id: orderId },
    data: { status: "REJECTED" },
  });
}

export interface BulkPaymentResult {
  succeeded: string[];
  failed: { id: string; error: string }[];
}

async function runBulk(
  ids: string[],
  handler: (id: string) => Promise<unknown>
): Promise<BulkPaymentResult> {
  const succeeded: string[] = [];
  const failed: { id: string; error: string }[] = [];
  // Sequential on purpose: each order settles in its own transaction and we
  // want predictable, isolated failures rather than a single rolled-back batch.
  for (const id of ids) {
    try {
      await handler(id);
      succeeded.push(id);
    } catch (error) {
      failed.push({
        id,
        error: error instanceof Error ? error.message : "Gagal memproses",
      });
    }
  }
  return { succeeded, failed };
}

export function approvePayments(
  orderIds: string[]
): Promise<BulkPaymentResult> {
  return runBulk(orderIds, settleOrderPaid);
}

export function rejectPayments(orderIds: string[]): Promise<BulkPaymentResult> {
  return runBulk(orderIds, rejectPayment);
}
