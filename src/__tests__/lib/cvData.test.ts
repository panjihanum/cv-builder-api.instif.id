import { describe, it, expect } from "vitest";
import { cvDataSchema, createEmptyCvData } from "@/lib/cvData.js";

describe("lib/cvData", () => {
  it("membuat cv data kosong dengan default lengkap", () => {
    const data = createEmptyCvData();
    expect(data.personal.fullName).toBe("");
    expect(data.personal.links).toEqual([]);
    expect(data.summary).toBe("");
    expect(data.experience).toEqual([]);
    expect(data.education).toEqual([]);
    expect(data.skills).toEqual([]);
    expect(data.projects).toEqual([]);
    expect(data.certifications).toEqual([]);
    expect(data.languages).toEqual([]);
    expect(data.customSections).toEqual([]);
  });

  it("mengisi field hilang dengan default saat parse parsial", () => {
    const data = cvDataSchema.parse({
      personal: { fullName: "Budi" },
      skills: [{ name: "TypeScript" }],
    });
    expect(data.personal.fullName).toBe("Budi");
    expect(data.personal.jobTitle).toBe("");
    expect(data.skills[0].level).toBe(3);
    expect(data.skills[0].id).toBe("");
  });

  it("menolak skill level di luar rentang 1-5", () => {
    expect(() =>
      cvDataSchema.parse({ skills: [{ name: "X", level: 6 }] })
    ).toThrow();
    expect(() =>
      cvDataSchema.parse({ skills: [{ name: "X", level: 0 }] })
    ).toThrow();
  });

  it("menerima struktur lengkap dengan nested custom sections", () => {
    const data = cvDataSchema.parse({
      customSections: [
        { id: "cs1", title: "Organisasi", items: [{ heading: "BEM" }] },
      ],
    });
    expect(data.customSections[0].items[0].heading).toBe("BEM");
    expect(data.customSections[0].items[0].body).toBe("");
  });
});
