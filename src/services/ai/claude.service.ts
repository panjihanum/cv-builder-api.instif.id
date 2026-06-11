import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { cvDataSchema, type CvData } from "@/lib/cvData.js";
import { HttpError } from "@/lib/httpError.js";
import { getRequiredSetting, getSetting } from "@/services/settings.service.js";

const CONFIG_MISSING_MESSAGE =
  "Anthropic API key belum dikonfigurasi, isi anthropic.apiKey di halaman admin settings";
const DEFAULT_MODEL = "claude-opus-4-8";
const EXTRACT_TOOL_NAME = "extract_cv_data";
const MAX_OUTPUT_TOKENS = 16000;
const SYSTEM_PROMPT =
  "Kamu adalah parser dokumen CV. Ekstrak data CV terstruktur dari teks dokumen yang diberikan. Jangan mengarang informasi yang tidak ada di dokumen. Kosongkan field yang tidak diketahui dengan string kosong atau array kosong. Tulis tanggal dalam format YYYY-MM.";
const RETRY_HINT =
  "Output sebelumnya tidak valid terhadap schema. Ulangi ekstraksi dan pastikan setiap field mengikuti schema tool dengan tepat.";

export function buildCvDataJsonSchema(): Anthropic.Tool.InputSchema {
  return z.toJSONSchema(cvDataSchema) as Anthropic.Tool.InputSchema;
}

async function createClaudeClient(): Promise<{
  client: Anthropic;
  model: string;
}> {
  const apiKey = await getRequiredSetting(
    "anthropic.apiKey",
    CONFIG_MISSING_MESSAGE
  );
  const model = (await getSetting("anthropic.model")) ?? DEFAULT_MODEL;
  return { client: new Anthropic({ apiKey }), model };
}

function withGeneratedId<T extends { id: string }>(item: T): T {
  return item.id ? item : { ...item, id: randomUUID() };
}

function fillGeneratedIds(data: CvData): CvData {
  return {
    ...data,
    personal: {
      ...data.personal,
      links: data.personal.links.map(withGeneratedId),
    },
    experience: data.experience.map(withGeneratedId),
    education: data.education.map(withGeneratedId),
    skills: data.skills.map(withGeneratedId),
    projects: data.projects.map(withGeneratedId),
    certifications: data.certifications.map(withGeneratedId),
    languages: data.languages.map(withGeneratedId),
    customSections: data.customSections.map((section) => ({
      ...withGeneratedId(section),
      items: section.items.map(withGeneratedId),
    })),
  };
}

async function requestExtraction(
  client: Anthropic,
  model: string,
  documentText: string,
  retryHint?: string
): Promise<unknown> {
  const content = retryHint ? `${documentText}\n\n${retryHint}` : documentText;
  const message = await client.messages.create({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
    tools: [
      {
        name: EXTRACT_TOOL_NAME,
        description:
          "Simpan data CV terstruktur hasil ekstraksi dari teks dokumen",
        input_schema: buildCvDataJsonSchema(),
      },
    ],
    tool_choice: { type: "tool", name: EXTRACT_TOOL_NAME },
  });
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new HttpError(502, "Claude tidak mengembalikan data terstruktur");
  }
  return toolUse.input;
}

export async function extractCvData(documentText: string): Promise<CvData> {
  const { client, model } = await createClaudeClient();
  const firstAttempt = await requestExtraction(client, model, documentText);
  const firstParse = cvDataSchema.safeParse(firstAttempt);
  if (firstParse.success) {
    return fillGeneratedIds(firstParse.data);
  }
  const secondAttempt = await requestExtraction(
    client,
    model,
    documentText,
    RETRY_HINT
  );
  const secondParse = cvDataSchema.safeParse(secondAttempt);
  if (!secondParse.success) {
    throw new HttpError(
      502,
      "Claude mengembalikan data yang tidak sesuai schema setelah retry"
    );
  }
  return fillGeneratedIds(secondParse.data);
}
