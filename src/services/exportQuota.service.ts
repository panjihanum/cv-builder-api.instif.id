import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";

export const FREE_DAILY_LIMIT = 2;
export const EXPORTS_PER_PACK = 10;
const PACK_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type ExportQuotaStatus = {
  freeUsedToday: number;
  freeDailyLimit: number;
  freeRemaining: number;
  packExports: number;
  packExpiresAt: string | null;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getQuotaStatus(
  userId: string
): Promise<ExportQuotaStatus> {
  const quota = await db.exportQuota.findUnique({ where: { userId } });
  const now = new Date();
  const today = startOfToday();

  if (!quota) {
    return {
      freeUsedToday: 0,
      freeDailyLimit: FREE_DAILY_LIMIT,
      freeRemaining: FREE_DAILY_LIMIT,
      packExports: 0,
      packExpiresAt: null,
    };
  }

  const isDailyReset = quota.freeDailyReset < today;
  const freeUsedToday = isDailyReset ? 0 : quota.freeDailyUsed;
  const isPackExpired = !quota.packExpiresAt || quota.packExpiresAt < now;
  const packExports = isPackExpired ? 0 : quota.packExports;

  return {
    freeUsedToday,
    freeDailyLimit: FREE_DAILY_LIMIT,
    freeRemaining: Math.max(0, FREE_DAILY_LIMIT - freeUsedToday),
    packExports,
    packExpiresAt:
      !isPackExpired && quota.packExpiresAt
        ? quota.packExpiresAt.toISOString()
        : null,
  };
}

/** Atomically consume one export slot. Throws 402 if no slots available. */
export async function useExportSlot(userId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const now = new Date();
    const today = startOfToday();

    const quota = await tx.exportQuota.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        freeDailyReset: today,
      },
    });

    const isDailyReset = quota.freeDailyReset < today;
    const freeUsedToday = isDailyReset ? 0 : quota.freeDailyUsed;
    const isPackExpired = !quota.packExpiresAt || quota.packExpiresAt < now;
    const packExports = isPackExpired ? 0 : quota.packExports;

    if (freeUsedToday < FREE_DAILY_LIMIT) {
      // Use a free slot
      await tx.exportQuota.update({
        where: { userId },
        data: {
          freeDailyUsed: isDailyReset ? 1 : { increment: 1 },
          freeDailyReset: isDailyReset ? today : undefined,
        },
      });
      return;
    }

    if (packExports > 0) {
      // Use a paid slot
      await tx.exportQuota.update({
        where: { userId },
        data: {
          packExports: { decrement: 1 },
          // Reset expired free daily if needed
          ...(isDailyReset ? { freeDailyUsed: 0, freeDailyReset: today } : {}),
        },
      });
      return;
    }

    throw new HttpError(
      402,
      "Batas export harian tercapai. Beli paket untuk export lebih banyak.",
      "EXPORT_LIMIT_REACHED"
    );
  });
}

/** Add export slots from a paid order. Called when order is settled. */
export async function addPackExports(
  userId: string,
  packs: number
): Promise<void> {
  const slots = packs * EXPORTS_PER_PACK;
  const newExpiry = new Date(Date.now() + PACK_DURATION_MS);
  const now = new Date();

  await db.$transaction(async (tx) => {
    const existing = await tx.exportQuota.findUnique({ where: { userId } });

    if (!existing) {
      await tx.exportQuota.create({
        data: {
          userId,
          packExports: slots,
          packExpiresAt: newExpiry,
          freeDailyReset: new Date(0),
        },
      });
      return;
    }

    const isPackExpired =
      !existing.packExpiresAt || existing.packExpiresAt < now;
    const existingPackExports = isPackExpired ? 0 : existing.packExports;
    const newPackExpiry =
      !isPackExpired &&
      existing.packExpiresAt &&
      existing.packExpiresAt > newExpiry
        ? existing.packExpiresAt
        : newExpiry;

    await tx.exportQuota.update({
      where: { userId },
      data: {
        packExports: existingPackExports + slots,
        packExpiresAt: newPackExpiry,
      },
    });
  });
}
