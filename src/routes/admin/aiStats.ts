import { Hono } from "hono";
import { z } from "zod";
import { db } from "@/lib/db.js";
import { requireApiKey } from "@/middleware/requireApiKey.js";

export const adminAiStatsRoutes = new Hono();

// Token pricing per million tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-8": { input: 15, output: 75 },
  "claude-opus-4-7": { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 0.8, output: 4 },
};

function estimateCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model] ?? { input: 15, output: 75 };
  return (
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output
  );
}

adminAiStatsRoutes.get("/", requireApiKey, async (c) => {
  const days = Number(c.req.query("days") ?? "30");
  const search = c.req.query("search") ?? "";
  const orderBy = c.req.query("orderBy") ?? "time"; // "time" | "user"
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const userFilter = search
    ? {
        user: {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        },
      }
    : {};

  const logsOrderBy =
    orderBy === "user"
      ? [{ user: { name: "asc" as const } }]
      : [{ createdAt: "desc" as const }];

  const [logs, endpointStats, modelStats, dailyRaw, userGroupRaw] =
    await Promise.all([
      db.aiUsageLog.findMany({
        where: { createdAt: { gte: since }, ...userFilter },
        orderBy: logsOrderBy,
        take: 100,
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
      db.aiUsageLog.groupBy({
        by: ["endpoint"],
        where: { createdAt: { gte: since } },
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
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true },
      }),
      db.$queryRaw<
        {
          day: string;
          calls: bigint;
          input_tokens: bigint;
          output_tokens: bigint;
          credits: bigint;
        }[]
      >`
        SELECT
          DATE("createdAt") AS day,
          COUNT(*)           AS calls,
          SUM("inputTokens") AS input_tokens,
          SUM("outputTokens") AS output_tokens,
          SUM("creditsUsed") AS credits
        FROM ai_usage_logs
        WHERE "createdAt" >= ${since}
        GROUP BY DATE("createdAt")
        ORDER BY day ASC
      `,
      db.$queryRaw<
        {
          userId: string;
          calls: bigint;
          input_tokens: bigint;
          output_tokens: bigint;
          credits: bigint;
        }[]
      >`
        SELECT
          "userId",
          COUNT(*)           AS calls,
          SUM("inputTokens") AS input_tokens,
          SUM("outputTokens") AS output_tokens,
          SUM("creditsUsed") AS credits
        FROM ai_usage_logs
        WHERE "createdAt" >= ${since}
        GROUP BY "userId"
        ORDER BY calls DESC
        LIMIT 20
      `,
    ]);

  // Enrich byUser with user name, email, status
  const userIds = userGroupRaw.map((u) => u.userId);
  const users =
    userIds.length > 0
      ? await db.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true, status: true },
        })
      : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const byUser = userGroupRaw.map((u) => {
    const user = userMap.get(u.userId);
    return {
      userId: u.userId,
      userName: user?.name ?? null,
      userEmail: user?.email ?? null,
      userStatus: user?.status ?? "ACTIVE",
      calls: Number(u.calls),
      inputTokens: Number(u.input_tokens),
      outputTokens: Number(u.output_tokens),
      creditsUsed: Number(u.credits),
    };
  });

  const aggTotals = endpointStats.reduce(
    (acc, e) => {
      acc.calls += e._count._all;
      acc.inputTokens += e._sum.inputTokens ?? 0;
      acc.outputTokens += e._sum.outputTokens ?? 0;
      acc.creditsUsed += e._sum.creditsUsed ?? 0;
      return acc;
    },
    { calls: 0, inputTokens: 0, outputTokens: 0, creditsUsed: 0 }
  );

  const failures = logs.filter((l) => !l.success).length;

  const estimatedCostUsd = modelStats.reduce((sum, m) => {
    return (
      sum +
      estimateCostUsd(
        m.model,
        m._sum.inputTokens ?? 0,
        m._sum.outputTokens ?? 0
      )
    );
  }, 0);

  const byEndpoint = endpointStats.map((e) => ({
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

  const byModel = modelStats.map((m) => ({
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

  const daily = dailyRaw.map((d) => ({
    day: String(d.day),
    calls: Number(d.calls),
    inputTokens: Number(d.input_tokens),
    outputTokens: Number(d.output_tokens),
    creditsUsed: Number(d.credits),
  }));

  return c.json({
    period: { days, since: since.toISOString() },
    totals: {
      calls: aggTotals.calls,
      inputTokens: aggTotals.inputTokens,
      outputTokens: aggTotals.outputTokens,
      totalTokens: aggTotals.inputTokens + aggTotals.outputTokens,
      creditsUsed: aggTotals.creditsUsed,
      estimatedCostUsd,
      failures,
    },
    byEndpoint,
    byModel,
    daily,
    byUser,
    recentLogs: logs,
  });
});

// Block / unblock a cv-builder user (from the AI monitoring panel)
adminAiStatsRoutes.patch("/users/:userId", requireApiKey, async (c) => {
  const userId = c.req.param("userId");

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Body JSON tidak valid" }, 400);
  }

  const parsed = z
    .object({ status: z.enum(["ACTIVE", "INACTIVE", "BANNED"]) })
    .safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Status tidak valid" }, 400);
  }

  const existing = await db.user.findUnique({ where: { id: userId } });
  if (!existing) {
    return c.json({ error: "User tidak ditemukan" }, 404);
  }

  const user = await db.user.update({
    where: { id: userId },
    data: { status: parsed.data.status },
    select: { id: true, name: true, email: true, status: true },
  });

  return c.json({ user });
});
