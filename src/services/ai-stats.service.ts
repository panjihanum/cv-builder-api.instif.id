import { Prisma } from "@prisma/client";

import { db } from "@/lib/db.js";
import { paginate, paginationArgs, type Paginated } from "@/lib/pagination.js";

/**
 * Angka di balik layar Monitoring AI di instif.id.
 *
 * Dipisah dari rutenya karena dua alasan: rute ini tinggal validasi + panggil,
 * dan bentuk `where` yang dipakai bersama oleh tujuh kueri sekaligus jadi bisa
 * diuji. Sebelumnya semua kueri ditulis di dalam handler, dan yang menyaring
 * hanya daftar lognya — tabel agregat di atasnya tetap seluruh periode, jadi
 * mencari satu pengguna memberi log satu orang di bawah total semua orang.
 */

/** Harga token per satu juta token (USD). */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-8": { input: 15, output: 75 },
  "claude-opus-4-7": { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 0.8, output: 4 },
};

/**
 * Model tak dikenal ditagih dengan tarif termahal yang kita punya.
 *
 * Sengaja pesimistis: perkiraan biaya yang kelewat rendah adalah perkiraan yang
 * tidak ada gunanya, dan model baru selalu muncul di log lebih dulu sebelum
 * sempat masuk tabel di atas.
 */
const FALLBACK_PRICING = { input: 15, output: 75 };

/**
 * Zona waktu yang dipakai untuk menjawab "ini hari apa".
 *
 * `createdAt` disimpan sebagai TIMESTAMP tanpa zona, isinya UTC. Memotongnya
 * apa adanya membuat panggilan pukul 06.00 WIB jatuh ke tanggal kemarin — dan
 * yang membaca halaman ini semuanya di Jakarta. Nilainya ikut dikirim di
 * `period.timeZone` supaya halaman mengelompokkan barisnya dengan batas hari
 * yang persis sama, bukan dengan tebakannya sendiri.
 */
export const REPORT_TIME_ZONE = "Asia/Jakarta";

export function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? FALLBACK_PRICING;
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

export const AI_STATS_LOG_ORDERS = ["time", "user"] as const;
export type AiStatsLogOrder = (typeof AI_STATS_LOG_ORDERS)[number];

export interface AiStatsQuery {
  days: number;
  search?: string;
  orderBy?: AiStatsLogOrder;
  logPage?: number;
  logPageSize?: number;
  userPage?: number;
  userPageSize?: number;
}

export interface AiEndpointStat {
  endpoint: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  creditsUsed: number;
  avgDurationMs: number;
}

export interface AiModelStat {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface AiDailyStat {
  day: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  creditsUsed: number;
}

export interface AiUserStat {
  userId: string;
  userName: string | null;
  userEmail: string | null;
  userStatus: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  creditsUsed: number;
}

export interface AiLogRow {
  id: string;
  userId: string;
  endpoint: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  creditsUsed: number;
  success: boolean;
  createdAt: Date;
  user: { name: string; email: string | null } | null;
}

export interface AiStats {
  period: { days: number; since: string; timeZone: string };
  filter: { search: string | null };
  totals: {
    calls: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    creditsUsed: number;
    estimatedCostUsd: number;
    failures: number;
    users: number;
  };
  byEndpoint: AiEndpointStat[];
  byModel: AiModelStat[];
  daily: AiDailyStat[];
  byUser: AiUserStat[];
  users: Omit<Paginated<AiUserStat>, "items">;
  recentLogs: AiLogRow[];
  logs: Omit<Paginated<AiLogRow>, "items">;
}

/**
 * Satu `where` untuk semua kueri di halaman ini.
 *
 * Pencarian menyaring pemilik log, bukan lognya, jadi ia bergabung lewat
 * relasi `user`. Kolom yang boleh disaring adalah daftar tertutup di sini —
 * teks pencarian tidak pernah menyentuh nama kolom.
 */
export function buildAiLogWhere(
  since: Date,
  search?: string
): Prisma.AiUsageLogWhereInput {
  const term = search?.trim();
  return {
    createdAt: { gte: since },
    ...(term
      ? {
          user: {
            OR: [
              { name: { contains: term, mode: "insensitive" as const } },
              { email: { contains: term, mode: "insensitive" as const } },
            ],
          },
        }
      : {}),
  };
}

/**
 * Urutan log. `user` mengurutkan per nama lalu waktu terbaru, karena itulah
 * yang dibaca halaman saat lognya dikelompokkan per pengguna — tanpa kunci
 * kedua, baris di dalam satu pengguna datang tanpa urutan sama sekali.
 */
function logOrderBy(
  order: AiStatsLogOrder
): Prisma.AiUsageLogOrderByWithRelationInput[] {
  return order === "user"
    ? [{ user: { name: "asc" } }, { createdAt: "desc" }]
    : [{ createdAt: "desc" }];
}

export async function getAiStats(query: AiStatsQuery): Promise<AiStats> {
  const {
    days,
    search,
    orderBy = "time",
    logPage = 1,
    logPageSize = 25,
    userPage = 1,
    userPageSize = 10,
  } = query;

  const term = search?.trim() || undefined;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = buildAiLogWhere(since, term);

  const [
    logs,
    logTotal,
    failures,
    endpointStats,
    modelStats,
    dailyRaw,
    userGroups,
  ] = await Promise.all([
    db.aiUsageLog.findMany({
      where,
      orderBy: logOrderBy(orderBy),
      ...paginationArgs(logPage, logPageSize),
      select: {
        id: true,
        userId: true,
        endpoint: true,
        model: true,
        inputTokens: true,
        outputTokens: true,
        durationMs: true,
        creditsUsed: true,
        success: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
      },
    }),
    db.aiUsageLog.count({ where }),
    // Dihitung di database atas seluruh periode. Dulu diambil dari 100 log yang
    // kebetulan tampil, jadi angka "gagal" berubah setiap kali halaman digeser
    // dan tidak pernah menyebut kegagalan di luar seratus baris itu.
    db.aiUsageLog.count({ where: { ...where, success: false } }),
    db.aiUsageLog.groupBy({
      by: ["endpoint"],
      where,
      _count: { _all: true },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        creditsUsed: true,
        durationMs: true,
      },
    }),
    db.aiUsageLog.groupBy({
      by: ["model"],
      where,
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true },
    }),
    dailySeries(since, term),
    // Seluruh pengguna periode ini, dipenggal di memori. Satu baris per
    // pengguna, jadi ukurannya sebesar jumlah pengguna aktif — bukan sebesar
    // jumlah log — dan totalnya ikut terjawab tanpa kueri hitung kedua.
    db.aiUsageLog.groupBy({
      by: ["userId"],
      where,
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true, creditsUsed: true },
      orderBy: { _count: { userId: "desc" } },
    }),
  ]);

  const userSlice = userGroups.slice(
    (userPage - 1) * userPageSize,
    (userPage - 1) * userPageSize + userPageSize
  );
  const profiles = await loadUserProfiles(userSlice.map((u) => u.userId));

  const byUser: AiUserStat[] = userSlice.map((u) => {
    const profile = profiles.get(u.userId);
    return {
      userId: u.userId,
      userName: profile?.name ?? null,
      userEmail: profile?.email ?? null,
      userStatus: profile?.status ?? "ACTIVE",
      calls: u._count._all,
      inputTokens: u._sum.inputTokens ?? 0,
      outputTokens: u._sum.outputTokens ?? 0,
      creditsUsed: u._sum.creditsUsed ?? 0,
    };
  });

  const byEndpoint: AiEndpointStat[] = endpointStats.map((e) => ({
    endpoint: e.endpoint,
    calls: e._count._all,
    inputTokens: e._sum.inputTokens ?? 0,
    outputTokens: e._sum.outputTokens ?? 0,
    creditsUsed: e._sum.creditsUsed ?? 0,
    avgDurationMs:
      e._count._all > 0
        ? Math.round((e._sum.durationMs ?? 0) / e._count._all)
        : 0,
  }));

  const byModel: AiModelStat[] = modelStats.map((m) => ({
    model: m.model,
    calls: m._count._all,
    inputTokens: m._sum.inputTokens ?? 0,
    outputTokens: m._sum.outputTokens ?? 0,
    estimatedCostUsd: estimateCostUsd(
      m.model,
      m._sum.inputTokens ?? 0,
      m._sum.outputTokens ?? 0
    ),
  }));

  const totals = byEndpoint.reduce(
    (acc, e) => {
      acc.calls += e.calls;
      acc.inputTokens += e.inputTokens;
      acc.outputTokens += e.outputTokens;
      acc.creditsUsed += e.creditsUsed;
      return acc;
    },
    { calls: 0, inputTokens: 0, outputTokens: 0, creditsUsed: 0 }
  );

  const logsPage = paginate(logs, logTotal, logPage, logPageSize);
  const usersPage = paginate(byUser, userGroups.length, userPage, userPageSize);

  return {
    period: {
      days,
      since: since.toISOString(),
      timeZone: REPORT_TIME_ZONE,
    },
    filter: { search: term ?? null },
    totals: {
      ...totals,
      totalTokens: totals.inputTokens + totals.outputTokens,
      estimatedCostUsd: byModel.reduce((sum, m) => sum + m.estimatedCostUsd, 0),
      failures,
      users: userGroups.length,
    },
    byEndpoint,
    byModel,
    daily: dailyRaw,
    byUser,
    users: {
      page: usersPage.page,
      pageSize: usersPage.pageSize,
      total: usersPage.total,
      totalPages: usersPage.totalPages,
    },
    recentLogs: logs,
    logs: {
      page: logsPage.page,
      pageSize: logsPage.pageSize,
      total: logsPage.total,
      totalPages: logsPage.totalPages,
    },
  };
}

async function loadUserProfiles(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<
      string,
      { name: string; email: string | null; status: string }
    >();
  }
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true, status: true },
  });
  return new Map(users.map((u) => [u.id, u]));
}

/**
 * Panggilan per hari.
 *
 * Tetap SQL mentah karena Prisma `groupBy` tidak bisa memotong timestamp jadi
 * tanggal. Saringan pencarian ikut masuk lewat `Prisma.sql`, bukan sambungan
 * string: setiap nilai tetap jadi parameter terikat, jadi teks apa pun yang
 * diketik admin di kotak cari tidak bisa berubah jadi SQL.
 *
 * Pemotongannya digeser ke REPORT_TIME_ZONE dulu. `createdAt` bertipe TIMESTAMP
 * tanpa zona berisi UTC, jadi ia dinyatakan UTC lebih dulu baru dipindah — tanpa
 * itu, panggilan pukul 06.00 WIB masuk ke batang tanggal kemarin.
 */
async function dailySeries(
  since: Date,
  search?: string
): Promise<AiDailyStat[]> {
  const userMatch = search
    ? Prisma.sql`
        AND "userId" IN (
          SELECT id FROM users
          WHERE name ILIKE ${`%${search}%`} OR email ILIKE ${`%${search}%`}
        )`
    : Prisma.empty;

  const localDay = Prisma.sql`DATE(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${REPORT_TIME_ZONE})`;

  /*
   * Dikembalikan sebagai teks, bukan sebagai DATE. Kolom DATE sampai di sisi
   * Node sebagai objek Date tengah malam, dan tengah malam menurut zona proses
   * mana adalah pertanyaan yang tidak perlu ditanyakan lagi setelah SQL di atas
   * sudah menjawabnya.
   */
  const rows = await db.$queryRaw<
    {
      day: string;
      calls: bigint;
      input_tokens: bigint | null;
      output_tokens: bigint | null;
      credits: bigint | null;
    }[]
  >`
    SELECT
      TO_CHAR(${localDay}, 'YYYY-MM-DD') AS day,
      COUNT(*)            AS calls,
      SUM("inputTokens")  AS input_tokens,
      SUM("outputTokens") AS output_tokens,
      SUM("creditsUsed")  AS credits
    FROM ai_usage_logs
    WHERE "createdAt" >= ${since}${userMatch}
    GROUP BY ${localDay}
    ORDER BY ${localDay} ASC
  `;

  return rows.map((d) => ({
    day: String(d.day),
    calls: Number(d.calls),
    inputTokens: Number(d.input_tokens ?? 0),
    outputTokens: Number(d.output_tokens ?? 0),
    creditsUsed: Number(d.credits ?? 0),
  }));
}

export async function setUserStatus(
  userId: string,
  status: "ACTIVE" | "INACTIVE" | "BANNED"
) {
  return db.user.update({
    where: { id: userId },
    data: { status },
    select: { id: true, name: true, email: true, status: true },
  });
}
