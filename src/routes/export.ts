import { Hono } from "hono";
import { z } from "zod";
import { cvDataSchema } from "@/lib/cvData.js";
import { validate } from "@/lib/validation.js";
import { requireAuth, type AuthEnv } from "@/middleware/requireAuth.js";
import * as creditService from "@/services/credit.service.js";
import * as cvService from "@/services/cv.service.js";
import * as templateService from "@/services/template.service.js";
import * as pdfService from "@/services/pdf.service.js";
import {
  createExportLink,
  resolveExportLink,
  readExportFile,
} from "@/services/exportLink.service.js";

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
    const pdfBuffer = Buffer.from(pdf.buffer, pdf.byteOffset, pdf.byteLength);

    // Create a shareable download link (fire-and-forget, don't fail export if this errors)
    let shareToken: string | null = null;
    try {
      shareToken = await createExportLink(userId, cv.title, pdfBuffer);
    } catch (err) {
      console.error("Failed to create export share link:", err);
    }

    c.header("Content-Type", "application/pdf");
    c.header(
      "Content-Disposition",
      `attachment; filename="${toFilename(cv.title)}"`
    );
    if (shareToken) {
      c.header("X-Share-Token", shareToken);
    }
    return c.body(pdfBuffer.buffer as ArrayBuffer);
  }
);

/** Public download endpoint — no auth required, token acts as capability. */
exportRoutes.get("/download/:token", async (c) => {
  const token = c.req.param("token");
  const link = await resolveExportLink(token);
  if (!link) {
    return c.json(
      { error: "Link tidak ditemukan atau sudah kedaluwarsa" },
      404
    );
  }
  let fileBuffer: Buffer;
  try {
    fileBuffer = await readExportFile(link.filePath);
  } catch {
    return c.json({ error: "File tidak ditemukan" }, 404);
  }
  c.header("Content-Type", "application/pdf");
  c.header(
    "Content-Disposition",
    `attachment; filename="${toFilename(link.cvTitle)}"`
  );
  return c.body(fileBuffer.buffer as ArrayBuffer);
});
