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
  /** Override model untuk request ini (mis. claude-haiku-4-5 untuk feature hemat). */
  modelOverride?: string;
}

export interface StructuredResult<Output> {
  data: Output;
  inputTokens: number;
  outputTokens: number;
  model: string;
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
): Promise<{
  input: unknown;
  usage: { input_tokens: number; output_tokens: number };
}> {
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
  return { input: toolUse.input, usage: message.usage };
}

export async function requestStructured<Output>(
  request: StructuredRequest<Output>
): Promise<StructuredResult<Output>> {
  const { client, model: defaultModel } = await createClaudeClient();
  const model = request.modelOverride ?? defaultModel;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const first = await requestToolInput(client, model, request);
  totalInputTokens += first.usage.input_tokens;
  totalOutputTokens += first.usage.output_tokens;

  const firstParse = request.schema.safeParse(first.input);
  if (firstParse.success) {
    return {
      data: firstParse.data,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      model,
    };
  }

  const second = await requestToolInput(client, model, request, RETRY_HINT);
  totalInputTokens += second.usage.input_tokens;
  totalOutputTokens += second.usage.output_tokens;

  const secondParse = request.schema.safeParse(second.input);
  if (!secondParse.success) {
    throw new HttpError(
      502,
      "Claude mengembalikan data yang tidak sesuai schema setelah retry"
    );
  }
  return {
    data: secondParse.data,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
    model,
  };
}
