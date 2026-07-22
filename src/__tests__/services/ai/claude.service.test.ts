import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db.js";
import { encrypt } from "@/lib/crypto.js";
import { invalidateSettingsCache } from "@/services/settings.service.js";
import * as claudeService from "@/services/ai/claude.service.js";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@/services/hubSettings.service.js", () => ({
  getHubSettings: vi.fn().mockResolvedValue({}),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));

function mockSettings(
  values: Record<string, { value: string; encrypted: boolean }>
) {
  vi.mocked(db.setting.findUnique).mockImplementation((async (args: {
    where: { key: string };
  }) => {
    const record = values[args.where.key];
    if (!record) return null;
    return {
      id: args.where.key,
      key: args.where.key,
      value: record.value,
      encrypted: record.encrypted,
      updatedAt: new Date(),
    };
  }) as never);
}

function anthropicSettings() {
  mockSettings({
    "anthropic.apiKey": { value: encrypt("sk-ant-test"), encrypted: true },
    "anthropic.model": { value: "claude-opus-4-8", encrypted: false },
  });
}

function toolUseResponse(input: unknown) {
  return {
    content: [
      { type: "tool_use", id: "toolu_1", name: "extract_cv_data", input },
    ],
    usage: { input_tokens: 10, output_tokens: 20 },
  };
}

const validInput = {
  personal: { fullName: "Budi Santoso", email: "budi@instif.id" },
  summary: "Backend engineer",
  experience: [
    {
      company: "PT Maju",
      position: "Engineer",
      startDate: "2022-01",
      endDate: "",
      current: true,
      description: "Membangun API",
    },
  ],
  skills: [{ name: "TypeScript", level: 4 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  invalidateSettingsCache();
});

describe("claude.service buildCvDataJsonSchema", () => {
  it("menghasilkan json schema object dengan field cvdata", () => {
    const schema = claudeService.buildCvDataJsonSchema() as {
      type: string;
      properties: Record<string, unknown>;
    };
    expect(schema.type).toBe("object");
    expect(Object.keys(schema.properties)).toEqual(
      expect.arrayContaining([
        "personal",
        "summary",
        "experience",
        "education",
        "skills",
        "projects",
        "certifications",
        "languages",
        "customSections",
      ])
    );
  });
});

describe("claude.service extractCvData", () => {
  it("melempar 503 saat api key belum dikonfigurasi", async () => {
    mockSettings({});
    await expect(claudeService.extractCvData("teks cv")).rejects.toMatchObject({
      status: 503,
    });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("mengembalikan cvdata valid dengan tool_choice dipaksa", async () => {
    anthropicSettings();
    createMock.mockResolvedValue(toolUseResponse(validInput));
    const result = await claudeService.extractCvData("teks cv budi");
    expect(result.data.personal.fullName).toBe("Budi Santoso");
    expect(result.data.experience[0].current).toBe(true);
    expect(result.data.experience[0].id).not.toBe("");
    expect(result.data.skills[0].id).not.toBe("");
    const request = createMock.mock.calls[0][0];
    expect(request.model).toBe("claude-opus-4-8");
    expect(request.tool_choice).toEqual({
      type: "tool",
      name: "extract_cv_data",
    });
    expect(request.tools[0].input_schema.type).toBe("object");
  });

  it("menginstruksikan format html (poin, bold, italic, underline) di system prompt", async () => {
    anthropicSettings();
    createMock.mockResolvedValue(toolUseResponse(validInput));
    await claudeService.extractCvData("teks cv");
    const system = createMock.mock.calls[0][0].system as string;
    expect(system).toContain("<ul><li>");
    expect(system).toContain("<strong>");
    expect(system).toContain("<em>");
    expect(system).toContain("<u>");
  });

  it("mempertahankan deskripsi html rich text hasil parse apa adanya", async () => {
    anthropicSettings();
    const html =
      "<ul><li><strong>Memimpin</strong> tim <em>backend</em></li><li><u>Menurunkan</u> latensi 40%</li></ul>";
    createMock.mockResolvedValue(
      toolUseResponse({
        ...validInput,
        experience: [{ ...validInput.experience[0], description: html }],
      })
    );
    const result = await claudeService.extractCvData("teks cv");
    expect(result.data.experience[0].description).toBe(html);
  });

  it("retry sekali saat output pertama tidak valid", async () => {
    anthropicSettings();
    createMock
      .mockResolvedValueOnce(
        toolUseResponse({ skills: [{ name: "X", level: 99 }] })
      )
      .mockResolvedValueOnce(toolUseResponse(validInput));
    const result = await claudeService.extractCvData("teks cv");
    expect(result.data.personal.fullName).toBe("Budi Santoso");
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("melempar 502 saat retry tetap tidak valid", async () => {
    anthropicSettings();
    createMock.mockResolvedValue(
      toolUseResponse({ skills: [{ name: "X", level: 99 }] })
    );
    await expect(claudeService.extractCvData("teks cv")).rejects.toMatchObject({
      status: 502,
    });
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("melempar 502 saat tidak ada blok tool_use", async () => {
    anthropicSettings();
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "tidak bisa" }],
    });
    await expect(claudeService.extractCvData("teks cv")).rejects.toMatchObject({
      status: 502,
    });
  });
});
