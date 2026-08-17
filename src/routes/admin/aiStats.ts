import { Hono } from "hono";
import { z } from "zod";

import { HttpError } from "@/lib/httpError.js";
import { MAX_PAGE_SIZE } from "@/lib/pagination.js";
import { validate } from "@/lib/validation.js";
import { requireApiKey } from "@/middleware/requireApiKey.js";
import * as aiStatsService from "@/services/ai-stats.service.js";
import { db } from "@/lib/db.js";

export const adminAiStatsRoutes = new Hono();

/**
 * Setiap angka di query string lewat schema ini dulu.
 *
 * `days` berbatas atas bukan karena rapi-rapian: nilainya jadi rentang tanggal
 * enam kueri agregat sekaligus, dan `?days=100000` memindai seluruh tabel.
 * Ukuran halaman ikut dibatasi lewat MAX_PAGE_SIZE yang sama dengan endpoint
 * admin lain, jadi tidak ada satu rute pun yang bisa diminta mengirim semuanya.
 */
const statsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
  search: z.string().trim().max(120).optional(),
  orderBy: z.enum(["time", "user"]).default("time"),
  logPage: z.coerce.number().int().min(1).default(1),
  logPageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
  userPage: z.coerce.number().int().min(1).default(1),
  userPageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(10),
});

const statusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "BANNED"]),
});

adminAiStatsRoutes.get(
  "/",
  requireApiKey,
  validate("query", statsQuerySchema),
  async (c) => {
    return c.json(await aiStatsService.getAiStats(c.req.valid("query")));
  }
);

// Blokir / aktifkan kembali pengguna cv-builder dari panel Monitoring AI.
adminAiStatsRoutes.patch(
  "/users/:userId",
  requireApiKey,
  validate("json", statusSchema),
  async (c) => {
    const userId = c.req.param("userId");
    const existing = await db.user.findUnique({ where: { id: userId } });
    if (!existing) throw new HttpError(404, "User tidak ditemukan");

    const user = await aiStatsService.setUserStatus(
      userId,
      c.req.valid("json").status
    );
    return c.json({ user });
  }
);
