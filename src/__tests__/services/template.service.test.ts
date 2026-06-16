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

const allTemplateIds = templateService.listTemplateIds();

describe("template.service", () => {
  it("mendaftarkan minimal satu template dengan id unik", () => {
    expect(allTemplateIds.length).toBeGreaterThanOrEqual(1);
    expect(new Set(allTemplateIds).size).toBe(allTemplateIds.length);
  });

  it("masih mendaftarkan template bawaan", () => {
    expect(allTemplateIds).toEqual(
      expect.arrayContaining(["classic-ats", "modern-professional"])
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

  it.each(allTemplateIds)(
    "template %s mengisi penuh tinggi halaman (min-height: 100vh)",
    (id) => {
      // Setiap template harus memenuhi minimal satu halaman penuh agar
      // background/sidebar tidak menyisakan area putih saat konten pendek —
      // sama seperti preview A4 di frontend.
      const html = templateService.renderTemplate(id, sampleData);
      expect(html).toContain("min-height: 100vh");
    }
  );

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

  it("mempertahankan format rich text (poin, bold, italic, underline) dari deskripsi html", () => {
    const richData = cvDataSchema.parse({
      ...sampleData,
      experience: [
        {
          ...sampleData.experience[0],
          description:
            "<ul><li><strong>Memimpin</strong> tim <em>backend</em></li><li><u>Menurunkan</u> latensi 40%</li></ul>",
        },
      ],
    });
    const html = templateService.renderTemplate("classic-ats", richData);
    expect(html).toContain("<ul><li><strong>Memimpin</strong>");
    expect(html).toContain("<em>backend</em>");
    expect(html).toContain("<u>Menurunkan</u>");
  });

  it("mengubah deskripsi teks polos multibaris menjadi poin-poin", () => {
    // Deskripsi lama (teks biasa, satu baris per poin) tetap tampil sebagai bullet list.
    const html = templateService.renderTemplate("classic-ats", sampleData);
    expect(html).toContain("<li>Memimpin tim backend.</li>");
    expect(html).toContain("<li>Menurunkan latensi 40%.</li>");
  });
});

describe("template.service full-bleed & padding halaman", () => {
  // Template full-bleed punya sidebar/banner edge-to-edge → diekspor tanpa
  // margin halaman. Sisanya satu kolom → dapat margin vertikal per halaman.
  // Full-bleed = true sidebar/banner templates: printed edge-to-edge, zero Puppeteer
  // margin, no per-page vertical whitespace from CSS (sidebar provides internal padding).
  const fullBleedIds = [
    "graphite",
    "onyx",
    "aurora",
    "vibrant",
    "two-column-compact",
    "designer-studio",
  ];
  // Non-fullBleed = single-column + editorial/bloom decorative templates: Puppeteer
  // adds 12mm top/bottom per page; body vertical padding is reset to avoid doubling.
  const paddedIds = [
    "clean-simple",
    "classic-ats",
    "modern-professional",
    "ats-professional",
    "ats-recruiter-focus",
    "ats-executive",
    "ats-compact",
    "minimalist-creative",
    "executive-senior",
    "editorial",
    "bloom",
  ];

  it.each(fullBleedIds)("menandai %s sebagai full-bleed", (id) => {
    expect(templateService.isFullBleed(id)).toBe(true);
  });

  it.each(paddedIds)("menandai %s bukan full-bleed", (id) => {
    expect(templateService.isFullBleed(id)).toBe(false);
  });

  it("klasifikasi full-bleed mencakup tepat semua template terdaftar", () => {
    expect([...fullBleedIds, ...paddedIds].sort()).toEqual(
      [...allTemplateIds].sort()
    );
  });

  it("melempar 400 untuk id tidak dikenal", () => {
    expect(() => templateService.isFullBleed("tidak-ada")).toThrow();
  });

  it.each(allTemplateIds)(
    "mereset padding vertikal body pada %s agar margin halaman tak terdobel",
    (id) => {
      const html = templateService.renderTemplate(id, sampleData);
      expect(html).toContain("padding-top:0;padding-bottom:0;");
    }
  );
});

describe("template.service biaya kredit", () => {
  // Tier visual: makin menonjol/kreatif makin mahal (4–12 kredit), classic-ats gratis.
  const expectedCosts: Record<string, number> = {
    "clean-simple": 0,
    "classic-ats": 0,
    "modern-professional": 4,
    "ats-professional": 4,
    "ats-recruiter-focus": 6,
    "ats-executive": 6,
    "ats-compact": 4,
    "executive-senior": 4,
    "two-column-compact": 6,
    "minimalist-creative": 6,
    aurora: 8,
    graphite: 8,
    vibrant: 10,
    editorial: 10,
    onyx: 10,
    bloom: 12,
    "designer-studio": 12,
  };

  it("memberi biaya berjenjang per template (gratis, lalu 4–12 kredit) dari default", async () => {
    // Tanpa setting tersimpan, biaya jatuh ke default tier (DB di-mock kosong).
    for (const id of allTemplateIds) {
      expect(await templateService.getTemplateCreditCost(id)).toBe(
        expectedCosts[id]
      );
    }
  });

  it("mencakup setiap template terdaftar dalam tabel biaya", () => {
    expect(Object.keys(expectedCosts).sort()).toEqual(
      [...allTemplateIds].sort()
    );
  });

  it("melempar 400 untuk template id tidak dikenal", async () => {
    await expect(
      templateService.getTemplateCreditCost("tidak-ada")
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("template.service padding preview↔PDF (konsistensi)", () => {
  // Sidebar templates: padding sidebar dan main harus sinkron dengan nilai React
  // (py-6/px-[18px] dan p-6) agar page break preview = PDF.
  const sidebarTemplates: Array<[string, string]> = [
    ["aurora", "padding: 24px 18px"],
    ["vibrant", "padding: 24px 18px"],
    ["graphite", "padding: 24px 18px"],
    ["onyx", "padding: 24px 18px"],
    ["two-column-compact", "padding: 24px 18px"],
  ];

  it.each(sidebarTemplates)(
    "template %s memiliki padding sidebar %s",
    (id, expectedPadding) => {
      const html = templateService.renderTemplate(id, sampleData);
      expect(html).toContain(expectedPadding);
    }
  );

  it.each([
    "aurora",
    "vibrant",
    "graphite",
    "onyx",
    "two-column-compact",
    "designer-studio",
  ])("template %s memiliki padding main 24px 24px", (id) => {
    const html = templateService.renderTemplate(id, sampleData);
    expect(html).toContain("padding: 24px 24px");
  });

  it("designer-studio memiliki padding hero 24px 28px", () => {
    const html = templateService.renderTemplate("designer-studio", sampleData);
    expect(html).toContain("padding: 24px 28px");
  });

  it("editorial memiliki padding halaman horizontal saja (0 vertikal — Puppeteer memberi margin)", () => {
    const html = templateService.renderTemplate("editorial", sampleData);
    expect(html).toContain("padding: 0 48px");
  });

  it("bloom memiliki padding halaman horizontal saja (0 vertikal — Puppeteer memberi margin)", () => {
    const html = templateService.renderTemplate("bloom", sampleData);
    expect(html).toContain("padding: 0 34px");
  });

  it("editorial dan bloom tidak lagi full-bleed (mendapat margin vertikal per halaman dari Puppeteer)", () => {
    expect(templateService.isFullBleed("editorial")).toBe(false);
    expect(templateService.isFullBleed("bloom")).toBe(false);
  });
});

describe("template.service aurora dan foto", () => {
  const photoData = cvDataSchema.parse({
    ...sampleData,
    personal: {
      ...sampleData.personal,
      photoUrl: "https://cdn.instif.id/foto.png",
    },
  });

  it("mendaftarkan aurora dengan sidebar gradien dan heading indonesia", () => {
    expect(allTemplateIds).toContain("aurora");
    const html = templateService.renderTemplate("aurora", sampleData);
    expect(html).toContain("linear-gradient(160deg,");
    expect(html).toContain("Ringkasan");
    expect(html).toContain("Pengalaman");
    expect(html).toContain("Keahlian");
  });

  it.each([
    "aurora",
    "two-column-compact",
    "minimalist-creative",
    "executive-senior",
  ])("merender foto pada template %s saat photoUrl terisi", (id) => {
    expect(templateService.renderTemplate(id, photoData)).toContain(
      '<img class="photo"'
    );
  });

  it.each(["classic-ats", "modern-professional"])(
    "tidak merender foto pada template %s",
    (id) => {
      expect(templateService.renderTemplate(id, photoData)).not.toContain(
        "<img"
      );
    }
  );
});

describe("template.service rich text deskripsi (semua template)", () => {
  // Deskripsi dari editor rich text (TipTap) berisi HTML <strong>/<em>/<u>/<ul>.
  // SEMUA template harus mempertahankan tag tersebut saat diekspor — termasuk
  // template sidebar/kreatif yang dulu memakai renderBullets/renderMultiline
  // (meng-escape HTML sehingga tag tampil sebagai teks mentah di PDF).
  const richData = cvDataSchema.parse({
    ...sampleData,
    experience: [
      {
        ...sampleData.experience[0],
        description:
          "<ul><li><strong>Memimpin</strong> tim <em>backend</em></li><li><u>Menurunkan</u> latensi 40%</li></ul>",
      },
    ],
  });

  it.each(allTemplateIds)(
    "template %s mempertahankan bold/italic/underline/list pada deskripsi (tidak ter-escape)",
    (id) => {
      const html = templateService.renderTemplate(id, richData);
      expect(html).toContain("<strong>Memimpin</strong>");
      expect(html).toContain("<em>backend</em>");
      expect(html).toContain("<u>Menurunkan</u>");
      expect(html).toContain("<li>");
      // Tidak boleh ada tag yang ter-escape menjadi teks.
      expect(html).not.toContain("&lt;strong&gt;");
      expect(html).not.toContain("&lt;ul&gt;");
    }
  );

  it("tetap meng-escape HTML berbahaya pada deskripsi rich text", () => {
    const evil = cvDataSchema.parse({
      ...sampleData,
      experience: [
        {
          ...sampleData.experience[0],
          description:
            '<p>aman</p><script>alert(1)</script><p onclick="x()">klik</p>',
        },
      ],
    });
    const html = templateService.renderTemplate("aurora", evil);
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("onclick=");
  });
});

describe("template.service ringkasan sebagai paragraf (semua template)", () => {
  // Ringkasan adalah teks biasa (textarea). Harus jadi paragraf dengan baris
  // baru dipertahankan (<br />), bukan daftar poin — agar konsisten dengan
  // preview (whitespace-pre-line) di frontend.
  const multilineSummary = cvDataSchema.parse({
    ...sampleData,
    summary: "Baris ringkasan satu\nBaris ringkasan dua",
  });

  it.each(allTemplateIds)(
    "template %s merender ringkasan multibaris sebagai paragraf ber-<br />",
    (id) => {
      const html = templateService.renderTemplate(id, multilineSummary);
      expect(html).toContain("Baris ringkasan satu<br />Baris ringkasan dua");
      expect(html).not.toContain("<li>Baris ringkasan satu</li>");
    }
  );
});
