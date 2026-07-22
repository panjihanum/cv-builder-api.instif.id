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
import * as translateService from "@/services/ai/translate.service.js";
import { logAiUsage } from "@/services/ai-log.service.js";
import { scrapeLinkedInProfile } from "@/services/ai/linkedin.service.js";
import * as linkedInOAuthService from "@/services/ai/linkedin-oauth.service.js";
import * as urlParseService from "@/services/ai/url-parse.service.js";

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
  data: z.unknown().optional(),
  rawText: z.string().optional(),
  language: z.enum(["en", "id", "zh"]).optional(),
});

const polishCvSchema = z.object({
  cvId: z.string().min(1),
});

const translateCvSchema = z.object({
  cvId: z.string().min(1),
  targetLanguage: z.enum(["en", "id", "zh"]),
});

const parseLinkedinSchema = z.object({
  url: z.string().url().optional(),
  text: z.string().optional(),
});

const parseUrlSchema = z.object({
  url: z.string().url({ message: "URL tidak valid" }),
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
  const start = Date.now();
  let success = true;
  let errorMessage: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;
  let model = "";
  let data;
  try {
    const result = await claudeService.extractCvData(text);
    data = result.data;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
    model = result.model;
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    void logAiUsage({
      userId,
      endpoint: "parse",
      model,
      inputTokens,
      outputTokens,
      durationMs: Date.now() - start,
      creditsUsed: success ? cost : 0,
      success,
      errorMessage,
    });
  }
  const credits = await creditService.consumeCredits(userId, cost);
  return c.json({ data, credits });
});

aiRoutes.post(
  "/parse-linkedin",
  requireAuth,
  validate("json", parseLinkedinSchema),
  async (c) => {
    const userId = c.get("user").sub;
    const { url, text } = c.req.valid("json");
    if (!url && !text) {
      throw new HttpError(
        400,
        "Masukkan URL profil atau salinan teks LinkedIn Anda"
      );
    }

    const cost = (await getCreditCosts()).aiParse;
    await creditService.assertCreditBalance(userId, cost);

    let profileText = "";
    if (text) {
      profileText = text;
    } else if (url) {
      try {
        profileText = await scrapeLinkedInProfile(url);
      } catch {
        throw new HttpError(
          400,
          "LinkedIn memblokir deteksi otomatis (authwall). Silakan salin teks profil Anda dan gunakan metode Copy-Paste di bawah.",
          "AUTHWALL"
        );
      }
    }

    const start = Date.now();
    let success = true;
    let errorMessage: string | undefined;
    let inputTokens = 0;
    let outputTokens = 0;
    let model = "";
    let data;
    try {
      const result = await claudeService.extractCvData(profileText);
      data = result.data;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      model = result.model;
    } catch (err) {
      success = false;
      errorMessage = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      void logAiUsage({
        userId,
        endpoint: "parse-linkedin",
        model,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - start,
        creditsUsed: success ? cost : 0,
        success,
        errorMessage,
      });
    }

    const credits = await creditService.consumeCredits(userId, cost);
    return c.json({ data, credits });
  }
);

const linkedinCallbackSchema = z.object({
  code: z.string().min(1, "Authorization code wajib ada"),
  state: z.string().min(1, "State token wajib ada"),
  redirectUri: z.string().url("Redirect URI tidak valid"),
});

aiRoutes.get("/linkedin/auth-url", requireAuth, async (c) => {
  const userId = c.get("user").sub;
  const redirectUri = c.req.query("redirectUri");
  if (!redirectUri) {
    throw new HttpError(400, "Query parameter redirectUri wajib diisi");
  }
  const authUrl = await linkedInOAuthService.getLinkedInAuthUrl(
    userId,
    redirectUri
  );
  return c.json({ authUrl });
});

aiRoutes.post(
  "/linkedin/callback",
  requireAuth,
  validate("json", linkedinCallbackSchema),
  async (c) => {
    const userId = c.get("user").sub;
    const { code, state, redirectUri } = c.req.valid("json");

    const cost = (await getCreditCosts()).aiParse;
    await creditService.assertCreditBalance(userId, cost);

    const start = Date.now();
    let success = true;
    let errorMessage: string | undefined;
    let inputTokens = 0;
    let outputTokens = 0;
    let model = "";
    let data;

    try {
      console.log(
        `[POST /ai/linkedin/callback] Processing request for user ${userId}...`
      );
      const result = await linkedInOAuthService.processLinkedInOAuth(
        userId,
        code,
        state,
        redirectUri
      );
      data = result.data;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      model = result.model;
      console.log(
        `[POST /ai/linkedin/callback] Success for user ${userId}. Model: ${model}`
      );
    } catch (err) {
      success = false;
      errorMessage = err instanceof Error ? err.message : String(err);
      console.error(
        `[POST /ai/linkedin/callback Error] User ${userId} failed:`,
        err
      );
      if (err instanceof HttpError) {
        throw err;
      }
      throw new HttpError(
        500,
        `Gagal memproses LinkedIn Callback: ${errorMessage}`
      );
    } finally {
      void logAiUsage({
        userId,
        endpoint: "linkedin-oauth-callback",
        model,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - start,
        creditsUsed: success ? cost : 0,
        success,
        errorMessage,
      });
    }

    const credits = await creditService.consumeCredits(userId, cost);
    return c.json({ data, credits });
  }
);

const sectionFileRule = {
  mimeTypes: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/csv",
    "application/csv",
    "text/plain",
  ],
  extensions: [".pdf", ".docx", ".csv", ".txt"],
  label: "pdf, docx, csv, atau txt",
};

aiRoutes.post("/improve-section", requireAuth, async (c) => {
  const userId = c.get("user").sub;
  const contentType = c.req.header("content-type") || "";

  let section: improveService.ImprovableSection;
  let sectionData: unknown;
  let rawText: string | undefined;
  let language: "en" | "id" | "zh" | undefined;

  if (contentType.includes("multipart/form-data")) {
    const body = await c.req.parseBody();
    const secVal = String(body.section || "");
    if (
      !improveService.IMPROVABLE_SECTIONS.includes(
        secVal as improveService.ImprovableSection
      )
    ) {
      throw new HttpError(400, "Section tidak valid");
    }
    section = secVal as improveService.ImprovableSection;
    if (body.data && typeof body.data === "string") {
      try {
        sectionData = JSON.parse(body.data);
      } catch {
        sectionData = undefined;
      }
    }
    rawText = typeof body.rawText === "string" ? body.rawText : undefined;
    language =
      typeof body.language === "string" &&
      ["en", "id", "zh"].includes(body.language)
        ? (body.language as "en" | "id" | "zh")
        : undefined;

    if (body.file) {
      const file = assertUploadedFile(body.file, sectionFileRule);
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileText = await parserService.extractTextFromFile(
        buffer,
        file.name,
        file.type
      );
      rawText = rawText ? `${rawText}\n\n${fileText}` : fileText;
    }
  } else {
    const json = await c.req.json();
    const parsedJson = improveSectionSchema.safeParse(json);
    if (!parsedJson.success) {
      throw new HttpError(
        400,
        `Input tidak valid: ${parsedJson.error.issues[0]?.message || "section tidak valid"}`
      );
    }
    section = parsedJson.data.section;
    sectionData = parsedJson.data.data;
    rawText = parsedJson.data.rawText;
    language = parsedJson.data.language;
  }

  const cost = (await getCreditCosts()).aiSectionImprove;
  await creditService.assertCreditBalance(userId, cost);
  const start = Date.now();
  let success = true;
  let errorMessage: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;
  let model = "";
  let improved;
  try {
    const result = await improveService.improveSection(
      section,
      sectionData,
      language,
      rawText
    );
    improved = result.data;
    inputTokens = result.inputTokens;
    outputTokens = result.outputTokens;
    model = result.model;
  } catch (err) {
    success = false;
    errorMessage = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    void logAiUsage({
      userId,
      endpoint: "improve",
      model,
      inputTokens,
      outputTokens,
      durationMs: Date.now() - start,
      creditsUsed: success ? cost : 0,
      success,
      errorMessage,
    });
  }
  const credits = await creditService.consumeCredits(userId, cost);
  return c.json({ data: improved, credits });
});

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
    const start = Date.now();
    let success = true;
    let errorMessage: string | undefined;
    let inputTokens = 0;
    let outputTokens = 0;
    let model = "";
    let polished;
    try {
      const result = await polishService.polishCv(data);
      polished = result.data;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      model = result.model;
    } catch (err) {
      success = false;
      errorMessage = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      void logAiUsage({
        userId,
        endpoint: "polish",
        model,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - start,
        creditsUsed: success ? cost : 0,
        success,
        errorMessage,
      });
    }
    await cvService.updateCv(userId, cvId, { data: polished });
    const credits = await creditService.consumeCredits(userId, cost);
    return c.json({ data: polished, credits });
  }
);

aiRoutes.post(
  "/translate-cv",
  requireAuth,
  validate("json", translateCvSchema),
  async (c) => {
    const userId = c.get("user").sub;
    const { cvId, targetLanguage } = c.req.valid("json");
    const cv = await cvService.getOwnedCv(userId, cvId);
    const data = cvDataSchema.parse(cv.data);
    if (data.language === targetLanguage) {
      throw new HttpError(400, "CV sudah dalam bahasa tersebut");
    }
    const cost = (await getCreditCosts()).aiTranslate;
    await creditService.assertCreditBalance(userId, cost);
    const start = Date.now();
    let success = true;
    let errorMessage: string | undefined;
    let inputTokens = 0;
    let outputTokens = 0;
    let model = "";
    let translated;
    try {
      const result = await translateService.translateCv(data, targetLanguage);
      translated = result.data;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      model = result.model;
    } catch (err) {
      success = false;
      errorMessage = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      void logAiUsage({
        userId,
        endpoint: "translate",
        model,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - start,
        creditsUsed: success ? cost : 0,
        success,
        errorMessage,
      });
    }
    await cvService.updateCv(userId, cvId, { data: translated });
    const credits = await creditService.consumeCredits(userId, cost);
    return c.json({ data: translated, credits });
  }
);

aiRoutes.post(
  "/parse-url",
  requireAuth,
  validate("json", parseUrlSchema),
  async (c) => {
    const userId = c.get("user").sub;
    const { url } = c.req.valid("json");

    const cost = (await getCreditCosts()).aiUrlParse;
    await creditService.assertCreditBalance(userId, cost);

    const start = Date.now();
    let success = true;
    let errorMessage: string | undefined;
    let inputTokens = 0;
    let outputTokens = 0;
    let model = "";
    let data;

    try {
      const result = await urlParseService.parseUrlForCv(url);
      data = result.data;
      inputTokens = result.inputTokens;
      outputTokens = result.outputTokens;
      model = result.model;
    } catch (err) {
      success = false;
      errorMessage = err instanceof Error ? err.message : String(err);
      if (err instanceof HttpError) {
        throw err;
      }
      throw new HttpError(400, `Gagal memproses URL: ${errorMessage}`);
    } finally {
      void logAiUsage({
        userId,
        endpoint: "parse-url",
        model,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - start,
        creditsUsed: success ? cost : 0,
        success,
        errorMessage,
      });
    }

    const credits = await creditService.consumeCredits(userId, cost);
    return c.json({ isValid: true, data, credits });
  }
);
