import { Hono } from "hono";
import { HttpError } from "@/lib/httpError.js";
import { assertUploadedFile } from "@/lib/uploads.js";
import { requireAuth, type AuthEnv } from "@/middleware/requireAuth.js";
import * as creditService from "@/services/credit.service.js";
import * as parserService from "@/services/ai/parser.service.js";
import * as claudeService from "@/services/ai/claude.service.js";

const cvFileRule = {
  mimeTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/csv",
    "application/csv",
  ],
  extensions: [".pdf", ".docx", ".csv"],
  label: "pdf, docx, atau csv",
};

export const aiRoutes = new Hono<AuthEnv>();

aiRoutes.post("/parse-cv", requireAuth, async (c) => {
  const userId = c.get("user").sub;
  const credit = await creditService.getCredit(userId);
  if (credit.aiUploadsLeft <= 0) {
    throw new HttpError(402, "Kuota upload AI habis, silakan beli paket");
  }
  const body = await c.req.parseBody();
  const file = assertUploadedFile(body.file, cvFileRule);
  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await parserService.extractTextFromFile(
    buffer,
    file.name,
    file.type
  );
  const data = await claudeService.extractCvData(text);
  const aiUploadsLeft = await creditService.consumeAiUploadCredit(userId);
  return c.json({ data, aiUploadsLeft });
});
