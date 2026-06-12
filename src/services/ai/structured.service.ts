import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { HttpError } from "@/lib/httpError.js";
import { getRequiredSetting, getSetting } from "@/services/settings.service.js";

const CONFIG_MISSING_MESSAGE =
  "Anthropic API key belum dikonfigurasi, isi anthropic.apiKey di halaman admin settings";
const DEFAULT_MODEL = "claude-opus-4-8";
const MAX_OUTPUT_TOKENS = 16000;
const RETRY_HINT =
  "Output sebelumnya tidak valid terhadap schema. Ulangi dan pastikan setiap field mengikuti schema tool dengan tepat.";

export interface StructuredRequest<Output> {
  system: string;
  userContent: string;
  toolName: string;
  toolDescription: string;
  schema: z.ZodType<Output>;
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

async function requestToolInput<Output>(
  client: Anthropic,
  model: string,
  request: StructuredRequest<Output>,
  retryHint?: string
): Promise<unknown> {
  const content = retryHint
    ? `${request.userContent}\n\n${retryHint}`
    : request.userContent;
  const message = await client.messages.create({
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: request.system,
    messages: [{ role: "user", content }],
    tools: [
      {
        name: request.toolName,
        description: request.toolDescription,
        input_schema: z.toJSONSchema(
          request.schema
        ) as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: request.toolName },
  });
  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
  );
  if (!toolUse) {
    throw new HttpError(502, "Claude tidak mengembalikan data terstruktur");
  }
  return toolUse.input;
}

export async function requestStructured<Output>(
  request: StructuredRequest<Output>
): Promise<Output> {
  const { client, model } = await createClaudeClient();
  const firstAttempt = await requestToolInput(client, model, request);
  const firstParse = request.schema.safeParse(firstAttempt);
  if (firstParse.success) {
    return firstParse.data;
  }
  const secondAttempt = await requestToolInput(
    client,
    model,
    request,
    RETRY_HINT
  );
  const secondParse = request.schema.safeParse(secondAttempt);
  if (!secondParse.success) {
    throw new HttpError(
      502,
      "Claude mengembalikan data yang tidak sesuai schema setelah retry"
    );
  }
  return secondParse.data;
}
