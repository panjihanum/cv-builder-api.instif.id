import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db.js";
import { encrypt } from "@/lib/crypto.js";
import { invalidateSettingsCache } from "@/services/settings.service.js";
import * as improveService from "@/services/ai/improve.service.js";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: createMock };
  },
}));

function mockAnthropicSettings() {
  vi.mocked(db.setting.findUnique).mockImplementation((async (args: {
    where: { key: string };
  }) => {
    if (args.where.key !== "anthropic.apiKey") return null;
    return {
      id: args.where.key,
      key: args.where.key,
      value: encrypt("sk-ant-test"),
      encrypted: true,
      updatedAt: new Date(),
    };
  }) as never);
}

function toolUseResponse(input: unknown) {
  return {
    content: [
      { type: "tool_use", id: "toolu_1", name: "improve_cv_section", input },
    ],
    usage: { input_tokens: 10, output_tokens: 20 },
  };
}

const experienceInput = [
  {
    id: "e1",
    company: "PT Maju",
    position: "Engineer",
    location: "Jakarta",
    startDate: "2022-01",
    endDate: "",
    current: true,
    description: "bikin api",
  },
];

const improvedExperience = [
  { ...experienceInput[0], description: "Membangun API berskala besar" },
];

beforeEach(() => {
  vi.clearAllMocks();
  invalidateSettingsCache();
});

describe("improve.service improveSection", () => {
  it("melempar 400 saat data tidak sesuai bentuk section", async () => {
    mockAnthropicSettings();
    await expect(
      improveService.improveSection("summary", { bukan: "string" })
    ).rejects.toMatchObject({ status: 400 });
    expect(createMock).not.toHaveBeenCalled();
  });

  it("memaksa tool use dengan schema sesuai section experience", async () => {
    mockAnthropicSettings();
    createMock.mockResolvedValue(toolUseResponse({ data: improvedExperience }));
    const result = await improveService.improveSection(
      "experience",
      experienceInput
    );
    expect(result.data).toEqual(improvedExperience);
    const request = createMock.mock.calls[0][0];
    expect(request.tool_choice).toEqual({
      type: "tool",
      name: "improve_cv_section",
    });
    expect(request.tools[0].input_schema.properties.data.type).toBe("array");
  });

  it("memakai schema string untuk section summary", async () => {
    mockAnthropicSettings();
    createMock.mockResolvedValue(
      toolUseResponse({ data: "Ringkasan profesional" })
    );
    const result = await improveService.improveSection(
      "summary",
      "ringkasan lama"
    );
    expect(result.data).toBe("Ringkasan profesional");
    const request = createMock.mock.calls[0][0];
    expect(request.tools[0].input_schema.properties.data.type).toBe("string");
  });

  it("retry sekali saat output pertama tidak valid", async () => {
    mockAnthropicSettings();
    createMock
      .mockResolvedValueOnce(toolUseResponse({ data: "bukan array" }))
      .mockResolvedValueOnce(toolUseResponse({ data: improvedExperience }));
    const result = await improveService.improveSection(
      "experience",
      experienceInput
    );
    expect(result.data).toEqual(improvedExperience);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("melempar 502 saat retry tetap tidak valid", async () => {
    mockAnthropicSettings();
    createMock.mockResolvedValue(toolUseResponse({ data: "bukan array" }));
    await expect(
      improveService.improveSection("experience", experienceInput)
    ).rejects.toMatchObject({ status: 502 });
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});
