import { Hono } from "hono";
import { z } from "zod";
import { cvDataSchema } from "@/lib/cvData.js";
import { validate } from "@/lib/validation.js";
import { requireAuth, type AuthEnv } from "@/middleware/requireAuth.js";
import * as creditService from "@/services/credit.service.js";
import * as cvService from "@/services/cv.service.js";
import * as templateService from "@/services/template.service.js";
import * as pdfService from "@/services/pdf.service.js";

const exportPdfSchema = z.object({
  cvId: z.string().min(1),
  templateId: z.string().min(1),
  pageSize: z.enum(["a4", "letter"]).optional().default("a4"),
});

function toFilename(title: string): string {
  const safe = title.replace(/[^a-zA-Z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  return `${safe || "cv"}.pdf`;
}

export const exportRoutes = new Hono<AuthEnv>();

exportRoutes.post(
  "/pdf",
  requireAuth,
  validate("json", exportPdfSchema),
  async (c) => {
    const userId = c.get("user").sub;
    const { cvId, templateId, pageSize } = c.req.valid("json");
    const creditCost = await templateService.getTemplateCreditCost(templateId);
    if (creditCost > 0) {
      await creditService.assertCreditBalance(userId, creditCost);
    }
    const cv = await cvService.getOwnedCv(userId, cvId);
    const data = cvDataSchema.parse(cv.data);
    const html = templateService.renderTemplate(templateId, data);
    const format = pageSize === "letter" ? "Letter" : "A4";
    const pdf = await pdfService.renderPdf(
      html,
      format,
      templateService.isFullBleed(templateId)
    );
    if (creditCost > 0) {
      await creditService.consumeCredits(userId, creditCost);
    }
    const pdfBuffer = pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength
    ) as ArrayBuffer;
    c.header("Content-Type", "application/pdf");
    c.header(
      "Content-Disposition",
      `attachment; filename="${toFilename(cv.title)}"`
    );
    return c.body(pdfBuffer);
  }
);
