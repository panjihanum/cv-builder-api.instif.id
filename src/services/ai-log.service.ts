import { db } from "@/lib/db.js";

export interface AiLogEntry {
  userId: string;
  endpoint: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  creditsUsed: number;
  success: boolean;
  errorMessage?: string;
}

export async function logAiUsage(entry: AiLogEntry): Promise<void> {
  try {
    await db.aiUsageLog.create({ data: entry });
  } catch {
    // Never fail the main request due to logging
  }
}
