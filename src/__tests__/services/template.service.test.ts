import { describe, it, expect } from "vitest";
import { cvDataSchema } from "@/lib/cvData.js";
import * as templateService from "@/services/template.service.js";

const sampleData = cvDataSchema.parse({
  personal: {
    fullName: "Budi Santoso",
    jobTitle: "Backend Engineer",
    email: "budi@instif.id",
    phone: "+628123456789",
    address: "Jakarta",
    links: [{ id: "l1", label: "GitHub", url: "https://github.com/budi" }],
  },
  summary: "Engineer berpengalaman membangun API skala besar.",
  experience: [
    {
      id: "e1",
      company: "PT Maju Jaya",
      position: "Senior Engineer",
      location: "Jakarta",
      startDate: "2021-03",
      endDate: "",
      current: true,
      description: "Memimpin tim backend.\nMenurunkan latensi 40%.",
    },
  ],
  education: [
    {
      id: "ed1",
      institution: "Universitas Indonesia",
      degree: "S1",
      field: "Ilmu Komputer",
      startDate: "2014-08",
      endDate: "2018-07",
      gpa: "3.8",
      description: "",
    },
  ],
  skills: [{ id: "s1", name: "TypeScript", level: 5 }],
  projects: [
    {
      id: "p1",
      name: "CV Builder",
      url: "https://cv.instif.id",
      description: "Aplikasi pembuat CV",
    },
  ],
  certifications: [
    { id: "c1", name: "AWS SAA", issuer: "Amazon", date: "2023-05" },
  ],
  languages: [{ id: "lg1", name: "Inggris", proficiency: "Lancar" }],
  customSections: [
    {
      id: "cs1",
      title: "Organisasi",
      items: [{ id: "i1", heading: "BEM", body: "Ketua divisi" }],
    },
  ],
});

const allTemplateIds = [
  "classic-ats",
  "modern-professional",
  "two-column-compact",
  "minimalist-creative",
  "executive-senior",
];

describe("template.service", () => {
  it("mendaftarkan lima template", () => {
    expect(templateService.listTemplateIds().sort()).toEqual(
      [...allTemplateIds].sort()
    );
  });

  it("melempar 400 untuk template id tidak dikenal", () => {
    try {
      templateService.renderTemplate("tidak-ada", sampleData);
      expect.unreachable();
    } catch (error) {
      expect(error).toMatchObject({ status: 400 });
    }
  });

  it.each(allTemplateIds)("merender template %s memuat data cv", (id) => {
    const html = templateService.renderTemplate(id, sampleData);
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Budi Santoso");
    expect(html).toContain("Backend Engineer");
    expect(html).toContain("PT Maju Jaya");
    expect(html).toContain("Universitas Indonesia");
    expect(html).toContain("TypeScript");
    expect(html).toContain("budi@instif.id");
    expect(html).toContain("Organisasi");
  });

  it.each(allTemplateIds)("meng-escape input user pada template %s", (id) => {
    const maliciousData = cvDataSchema.parse({
      personal: {
        fullName: '<script>alert("xss")</script>',
        jobTitle: "a & b <i>",
      },
      summary: "</style><img src=x onerror=alert(1)>",
    });
    const html = templateService.renderTemplate(id, maliciousData);
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &amp; b &lt;i&gt;");
  });

  it("merender tanggal berjalan sebagai present", () => {
    const html = templateService.renderTemplate("classic-ats", sampleData);
    expect(html).toContain("2021-03 - Present");
  });
});
