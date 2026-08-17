import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db.js";
import * as aiStats from "@/services/ai-stats.service.js";

beforeEach(() => {
  vi.clearAllMocks();
});

/**
 * Semua kueri `getAiStats` berangkat dalam satu `Promise.all`, jadi urutan
 * pemanggilannya tetap: findMany → count(total) → count(gagal) →
 * groupBy(endpoint) → groupBy(model) → $queryRaw(harian) → groupBy(user).
 */
function mockQueries(
  options: {
    logs?: unknown[];
    logTotal?: number;
    failures?: number;
    endpoints?: unknown[];
    models?: unknown[];
    daily?: unknown[];
    users?: unknown[];
    profiles?: unknown[];
  } = {}
) {
  vi.mocked(db.aiUsageLog.findMany).mockResolvedValue(
    (options.logs ?? []) as never
  );
  vi.mocked(db.aiUsageLog.count)
    .mockResolvedValueOnce((options.logTotal ?? 0) as never)
    .mockResolvedValueOnce((options.failures ?? 0) as never);
  vi.mocked(db.aiUsageLog.groupBy)
    .mockResolvedValueOnce((options.endpoints ?? []) as never)
    .mockResolvedValueOnce((options.models ?? []) as never)
    .mockResolvedValueOnce((options.users ?? []) as never);
  vi.mocked(db.$queryRaw).mockResolvedValue((options.daily ?? []) as never);
  vi.mocked(db.user.findMany).mockResolvedValue(
    (options.profiles ?? []) as never
  );
}

function userGroup(userId: string, calls: number) {
  return {
    userId,
    _count: { _all: calls },
    _sum: { inputTokens: 10, outputTokens: 20, creditsUsed: 1 },
  };
}

describe("estimateCostUsd", () => {
  it("memakai tarif model yang dikenal", () => {
    // haiku: $0.8 / juta input, $4 / juta output.
    expect(
      aiStats.estimateCostUsd("claude-haiku-4-5", 1_000_000, 1_000_000)
    ).toBeCloseTo(4.8);
  });

  // Perkiraan yang kerendahan tidak ada gunanya, dan model baru selalu muncul di
  // log lebih dulu sebelum sempat masuk tabel harga.
  it("menagih model tak dikenal dengan tarif termahal", () => {
    expect(
      aiStats.estimateCostUsd("model-besok", 1_000_000, 1_000_000)
    ).toBeCloseTo(90);
  });
});

describe("buildAiLogWhere", () => {
  const since = new Date("2026-08-01T00:00:00.000Z");

  it("tanpa search hanya membatasi rentang waktu", () => {
    expect(aiStats.buildAiLogWhere(since)).toEqual({
      createdAt: { gte: since },
    });
  });

  it("menyaring lewat relasi user saat ada search", () => {
    const where = aiStats.buildAiLogWhere(since, "budi");
    expect(where.user).toEqual({
      OR: [
        { name: { contains: "budi", mode: "insensitive" } },
        { email: { contains: "budi", mode: "insensitive" } },
      ],
    });
  });

  // Kotak cari yang berisi spasi saja adalah kotak cari kosong. Tanpa ini
  // halaman menampilkan "0 hasil" sesudah admin menghapus ketikannya.
  it("memperlakukan spasi saja sebagai tanpa search", () => {
    expect(aiStats.buildAiLogWhere(since, "   ")).toEqual({
      createdAt: { gte: since },
    });
  });
});

describe("getAiStats", () => {
  it("menerapkan skip/take log sesuai halaman yang diminta", async () => {
    mockQueries({ logTotal: 130 });

    const stats = await aiStats.getAiStats({
      days: 30,
      logPage: 3,
      logPageSize: 25,
    });

    const args = vi.mocked(db.aiUsageLog.findMany).mock.calls[0][0];
    expect(args?.skip).toBe(50);
    expect(args?.take).toBe(25);
    expect(stats.logs).toMatchObject({
      page: 3,
      pageSize: 25,
      total: 130,
      totalPages: 6,
    });
  });

  /*
   * Angka ini dulu diambil dari 100 log yang kebetulan tampil, jadi ia berubah
   * setiap kali halaman digeser dan tidak pernah menyebut kegagalan di luar
   * seratus baris itu. Sekarang dihitung sendiri di database.
   */
  it("menghitung kegagalan atas seluruh periode, bukan atas halaman yang tampil", async () => {
    mockQueries({
      logs: [{ id: "l1", success: true }],
      logTotal: 4000,
      failures: 37,
    });

    const stats = await aiStats.getAiStats({ days: 30 });

    expect(stats.totals.failures).toBe(37);
    const failureCall = vi.mocked(db.aiUsageLog.count).mock.calls[1][0];
    expect(failureCall?.where).toMatchObject({ success: false });
  });

  // Dulu hanya daftar lognya yang tersaring: mencari satu orang memberi log satu
  // orang di bawah total semua orang, dan angka itu terbaca sebagai miliknya.
  it("meneruskan saringan pencarian ke agregat, bukan hanya ke daftar log", async () => {
    mockQueries();

    await aiStats.getAiStats({ days: 30, search: "budi" });

    const endpointCall = vi.mocked(db.aiUsageLog.groupBy).mock.calls[0][0];
    const modelCall = vi.mocked(db.aiUsageLog.groupBy).mock.calls[1][0];
    expect(endpointCall?.where).toHaveProperty("user");
    expect(modelCall?.where).toHaveProperty("user");
    expect(
      vi.mocked(db.aiUsageLog.count).mock.calls[0][0]?.where
    ).toHaveProperty("user");
  });

  it("melaporkan kembali saringan yang benar-benar terpakai", async () => {
    mockQueries();

    // Dipakai halaman untuk memberi tahu bahwa angka di layar sudah tersaring.
    // Spasi saja bukan saringan, jadi ia harus kembali sebagai null.
    expect(
      (await aiStats.getAiStats({ days: 30, search: "  budi " })).filter
    ).toEqual({
      search: "budi",
    });
  });

  it("tidak menganggap kotak cari berisi spasi sebagai saringan", async () => {
    mockQueries();

    expect(
      (await aiStats.getAiStats({ days: 30, search: "   " })).filter
    ).toEqual({
      search: null,
    });
  });

  it("memenggal daftar pengguna dan melaporkan jumlah seluruhnya", async () => {
    mockQueries({
      users: [
        userGroup("u1", 90),
        userGroup("u2", 80),
        userGroup("u3", 70),
        userGroup("u4", 60),
        userGroup("u5", 50),
      ],
      profiles: [
        { id: "u3", name: "Citra", email: "c@x.id", status: "BANNED" },
      ],
    });

    const stats = await aiStats.getAiStats({
      days: 30,
      userPage: 2,
      userPageSize: 2,
    });

    expect(stats.byUser.map((u) => u.userId)).toEqual(["u3", "u4"]);
    expect(stats.users).toMatchObject({
      page: 2,
      pageSize: 2,
      total: 5,
      totalPages: 3,
    });
    // Profil hanya diambil untuk halaman yang tampil, bukan untuk kelima-limanya.
    expect(vi.mocked(db.user.findMany).mock.calls[0][0]?.where).toEqual({
      id: { in: ["u3", "u4"] },
    });
    expect(stats.byUser[0]).toMatchObject({
      userName: "Citra",
      userStatus: "BANNED",
    });
  });

  // Pengguna yang lognya ada tapi barisnya sudah terhapus tetap harus tampil —
  // konsumsinya nyata, dan menyembunyikannya membuat total tidak pernah cocok.
  it("tetap menampilkan pengguna yang profilnya tidak ditemukan", async () => {
    mockQueries({ users: [userGroup("hilang", 5)], profiles: [] });

    const stats = await aiStats.getAiStats({ days: 30 });

    expect(stats.byUser[0]).toMatchObject({
      userId: "hilang",
      userName: null,
      userStatus: "ACTIVE",
      calls: 5,
    });
  });

  /*
   * Batas hari dipakai dua kali: di sini untuk batang tren, dan di halaman untuk
   * memisahkan baris log per tanggal. Keduanya harus memakai zona yang sama,
   * jadi zona itu ikut dikirim daripada ditebak ulang di sisi halaman.
   */
  it("menyebutkan zona waktu yang dipakai memotong hari", async () => {
    mockQueries();

    const stats = await aiStats.getAiStats({ days: 30 });

    expect(stats.period.timeZone).toBe(aiStats.REPORT_TIME_ZONE);
  });

  it("memotong hari di zona laporan, dengan zonanya sebagai parameter terikat", async () => {
    mockQueries();

    await aiStats.getAiStats({ days: 30 });

    // Argumen setelah yang pertama adalah nilai-nilai template; potongan
    // `Prisma.sql` mengaku lewat pasangan `sql`/`values`.
    const fragments = vi
      .mocked(db.$queryRaw)
      .mock.calls[0].slice(1)
      .filter(
        (value): value is { sql: string; values: unknown[] } =>
          typeof (value as { sql?: unknown })?.sql === "string"
      );

    const shifted = fragments.find((f) => f.sql.includes("AT TIME ZONE"));
    expect(shifted).toBeDefined();
    // Terikat, bukan disambung ke dalam teks SQL.
    expect(shifted?.values).toContain(aiStats.REPORT_TIME_ZONE);
  });

  it("mengurutkan log per nama lalu waktu saat diminta dikelompokkan per user", async () => {
    mockQueries();

    await aiStats.getAiStats({ days: 30, orderBy: "user" });

    expect(vi.mocked(db.aiUsageLog.findMany).mock.calls[0][0]?.orderBy).toEqual(
      [{ user: { name: "asc" } }, { createdAt: "desc" }]
    );
  });

  it("menjumlahkan total dari agregat endpoint dan biaya dari agregat model", async () => {
    mockQueries({
      endpoints: [
        {
          endpoint: "parse",
          _count: { _all: 3 },
          _sum: {
            inputTokens: 1000,
            outputTokens: 500,
            creditsUsed: 3,
            durationMs: 3000,
          },
        },
      ],
      models: [
        {
          model: "claude-haiku-4-5",
          _count: { _all: 3 },
          _sum: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
        },
      ],
    });

    const stats = await aiStats.getAiStats({ days: 30 });

    expect(stats.totals).toMatchObject({
      calls: 3,
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
      creditsUsed: 3,
    });
    expect(stats.totals.estimatedCostUsd).toBeCloseTo(4.8);
    expect(stats.byEndpoint[0].avgDurationMs).toBe(1000);
  });
});
