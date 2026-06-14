import { Hono } from "hono";
import { z } from "zod";
import { cvDataSchema } from "@/lib/cvData.js";
import { HttpError } from "@/lib/httpError.js";
import { assertUploadedFile } from "@/lib/uploads.js";
import { validate } from "@/lib/validation.js";
import { requireAuth, type AuthEnv } from "@/middleware/requireAuth.js";
import { getCreditCosts } from "@/services/settings.service.js";
import * as creditService from "@/services/credit.service.js";
import * as cvService from "@/services/cv.service.js";
import * as parserService from "@/services/ai/parser.service.js";
import * as claudeService from "@/services/ai/claude.service.js";
import * as improveService from "@/services/ai/improve.service.js";
import * as polishService from "@/services/ai/polish.service.js";

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

const improveSectionSchema = z.object({
  section: z.enum(improveService.IMPROVABLE_SECTIONS),
  data: z.unknown(),
});

const polishCvSchema = z.object({
  cvId: z.string().min(1),
});

export const aiRoutes = new Hono<AuthEnv>();

aiRoutes.post("/parse-cv", requireAuth, async (c) => {
  const userId = c.get("user").sub;
  const cost = (await getCreditCosts()).aiParse;
  await creditService.assertCreditBalance(userId, cost);
  const body = await c.req.parseBody();
  const file = assertUploadedFile(body.file, cvFileRule);
  const buffer = Buffer.from(await file.arrayBuffer());
  const text = await parserService.extractTextFromFile(
    buffer,
    file.name,
    file.type
  );
  const data = await claudeService.extractCvData(text);
  const credits = await creditService.consumeCredits(userId, cost);
  return c.json({ data, credits });
});

aiRoutes.post(
  "/improve-section",
  requireAuth,
  validate("json", improveSectionSchema),
  async (c) => {
    const userId = c.get("user").sub;
    const { section, data } = c.req.valid("json");
    const cost = (await getCreditCosts()).aiSectionImprove;
    await creditService.assertCreditBalance(userId, cost);
    const improved = await improveService.improveSection(section, data);
    const credits = await creditService.consumeCredits(userId, cost);
    return c.json({ data: improved, credits });
  }
);

aiRoutes.post(
  "/polish-cv",
  requireAuth,
  validate("json", polishCvSchema),
  async (c) => {
    const userId = c.get("user").sub;
    const { cvId } = c.req.valid("json");
    const cv = await cvService.getOwnedCv(userId, cvId);
    const data = cvDataSchema.parse(cv.data);
    const missing = polishService.findIncompleteParts(data);
    if (missing.length > 0) {
      throw new HttpError(400, `Lengkapi dulu: ${missing.join(", ")}`);
    }
    const cost = (await getCreditCosts()).aiPolish;
    await creditService.assertCreditBalance(userId, cost);
    const polished = await polishService.polishCv(data);
    await cvService.updateCv(userId, cvId, { data: polished });
    const credits = await creditService.consumeCredits(userId, cost);
    return c.json({ data: polished, credits });
  }
);
