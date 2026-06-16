import { describe, it, expect, beforeEach, vi } from "vitest";
import { db } from "@/lib/db.js";
import { encrypt } from "@/lib/crypto.js";
import { cvDataSchema, createEmptyCvData } from "@/lib/cvData.js";
import { invalidateSettingsCache } from "@/services/settings.service.js";
import * as polishService from "@/services/ai/polish.service.js";

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

const completeCv = cvDataSchema.parse({
  personal: { fullName: "Budi Santoso", email: "budi@instif.id" },
  summary: "Backend engineer berpengalaman",
  experience: [{ id: "e1", company: "PT Maju", position: "Engineer" }],
  education: [{ id: "ed1", institution: "UI", degree: "S1" }],
  skills: [{ id: "s1", name: "TypeScript", level: 4 }],
});

beforeEach(() => {
  vi.clearAllMocks();
  invalidateSettingsCache();
});

describe("polish.service findIncompleteParts", () => {
  it("mendaftar semua bagian wajib saat cv kosong", () => {
    expect(polishService.findIncompleteParts(createEmptyCvData())).toEqual([
      "nama lengkap",
      "email",
      "ringkasan",
      "pengalaman",
      "pendidikan",
      "keahlian",
    ]);
  });

  it("mengembalikan array kosong saat cv lengkap", () => {
    expect(polishService.findIncompleteParts(completeCv)).toEqual([]);
  });

  it("mendeteksi bagian tertentu yang kosong", () => {
    const missingSummary = { ...completeCv, summary: "   " };
    expect(polishService.findIncompleteParts(missingSummary)).toEqual([
      "ringkasan",
    ]);
  });
});

describe("polish.service polishCv", () => {
  it("memaksa tool use dengan schema penuh cvdata", async () => {
    mockAnthropicSettings();
    const polished = {
      ...completeCv,
      summary: "Backend engineer dengan rekam jejak terbukti",
    };
    createMock.mockResolvedValue({
      content: [
        { type: "tool_use", id: "t1", name: "polish_cv_data", input: polished },
      ],
      usage: { input_tokens: 10, output_tokens: 20 },
    });
    const result = await polishService.polishCv(completeCv);
    expect(result.data.summary).toBe(
      "Backend engineer dengan rekam jejak terbukti"
    );
    const request = createMock.mock.calls[0][0];
    expect(request.tool_choice).toEqual({
      type: "tool",
      name: "polish_cv_data",
    });
    expect(Object.keys(request.tools[0].input_schema.properties)).toEqual(
      expect.arrayContaining(["personal", "summary", "experience", "skills"])
    );
  });

  it("melempar 502 saat retry tetap tidak valid", async () => {
    mockAnthropicSettings();
    createMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          id: "t1",
          name: "polish_cv_data",
          input: { skills: [{ name: "X", level: 99 }] },
        },
      ],
      usage: { input_tokens: 10, output_tokens: 20 },
    });
    await expect(polishService.polishCv(completeCv)).rejects.toMatchObject({
      status: 502,
    });
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});
