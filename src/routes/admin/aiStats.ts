import { Hono } from "hono";
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
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [logs, endpointStats, modelStats, dailyRaw] = await Promise.all([
    db.aiUsageLog.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
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
  ]);

  const totals = logs.reduce(
    (acc, l) => {
      acc.calls++;
      acc.inputTokens += l.inputTokens;
      acc.outputTokens += l.outputTokens;
      acc.creditsUsed += l.creditsUsed;
      acc.failures += l.success ? 0 : 1;
      return acc;
    },
    { calls: 0, inputTokens: 0, outputTokens: 0, creditsUsed: 0, failures: 0 }
  );

  // Aggregate totals from groupBy for accurate totals (logs is limited to 100)
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
      failures: totals.failures,
    },
    byEndpoint,
    byModel,
    daily,
    recentLogs: logs,
  });
});
