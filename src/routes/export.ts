import { Hono } from "hono";
import { z } from "zod";
import { cvDataSchema } from "@/lib/cvData.js";
import { HttpError } from "@/lib/httpError.js";
import { validate } from "@/lib/validation.js";
import { requireAuth, type AuthEnv } from "@/middleware/requireAuth.js";
import * as creditService from "@/services/credit.service.js";
import * as cvService from "@/services/cv.service.js";
import * as templateService from "@/services/template.service.js";
import * as pdfService from "@/services/pdf.service.js";

const exportPdfSchema = z.object({
  cvId: z.string().min(1),
  templateId: z.string().min(1),
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
    const { cvId, templateId } = c.req.valid("json");
    const credit = await creditService.getCredit(userId);
    if (credit.exportLeft <= 0) {
      throw new HttpError(402, "Kredit export habis, silakan beli paket");
    }
    const cv = await cvService.getOwnedCv(userId, cvId);
    const data = cvDataSchema.parse(cv.data);
    const html = templateService.renderTemplate(templateId, data);
    const pdf = await pdfService.renderPdf(html);
    await creditService.consumeExportCredit(userId);
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
