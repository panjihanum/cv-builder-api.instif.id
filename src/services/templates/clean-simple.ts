import type { CvData } from "@/lib/cvData.js";
import {
  documentShell,
  escapeHtml,
  joinNonEmpty,
  formatDateRange,
  renderDescription,
} from "@/services/templates/shared.js";

const css = `
* { box-sizing: border-box; }
body { font-family: Arial, Helvetica, sans-serif; color: #222; font-size: 10pt; line-height: 1.55; margin: 0; min-height: 100vh; padding: 44px 52px; }
h1 { font-size: 20pt; margin: 0 0 2px; font-weight: 700; color: #111; letter-spacing: 0.01em; }
.role { font-size: 10.5pt; color: #555; margin: 0 0 5px; }
.contact { font-size: 9pt; color: #444; margin: 0; }
header { border-bottom: 2px solid #222; padding-bottom: 10px; margin-bottom: 14px; }
section { margin-bottom: 12px; }
h2 { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: #333; border-bottom: 1px solid #ccc; padding-bottom: 2px; margin: 0 0 7px; }
.entry { margin-bottom: 8px; }
.row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.entry-title { font-weight: 700; font-size: 10pt; }
.entry-date { font-size: 8.5pt; color: #666; white-space: nowrap; }
.entry-sub { font-size: 9pt; color: #555; margin: 1px 0 3px; }
ul { margin: 3px 0 0; padding-left: 16px; }
li { margin-bottom: 1px; }
p { margin: 3px 0; }
strong { font-weight: 700; }
em { font-style: italic; }
u { text-decoration: underline; }
.skills-list { display: flex; flex-wrap: wrap; gap: 4px 12px; }
.skill-item { font-size: 9.5pt; }
.inline { display: inline; }
.inline:not(:last-child)::after { content: " · "; color: #888; }
`;

export function renderCleanSimple(data: CvData): string {
  const { personal } = data;

  const contact = [
    personal.email,
    personal.phone,
    personal.address,
    ...personal.links.map((l) =>
      joinNonEmpty([l.label, l.url].map(escapeHtml), ": ")
    ),
  ]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" &middot; ");

  const header = `<header>
    <h1>${escapeHtml(personal.fullName)}</h1>
    ${personal.jobTitle ? `<p class="role">${escapeHtml(personal.jobTitle)}</p>` : ""}
    ${contact ? `<p class="contact">${contact}</p>` : ""}
  </header>`;

  const sections: string[] = [];

  if (data.summary.trim()) {
    const sumHtml = renderDescription(data.summary);
    sections.push(
      `<section><h2>Ringkasan</h2>${sumHtml.startsWith("<") ? sumHtml : `<p>${sumHtml}</p>`}</section>`
    );
  }

  if (data.experience.length > 0) {
    const entries = data.experience
      .map((exp) => {
        const dateRange = formatDateRange(
          exp.startDate,
          exp.endDate,
          exp.current
        );
        const sub = joinNonEmpty(
          [escapeHtml(exp.company), escapeHtml(exp.location)],
          ", "
        );
        const desc = renderDescription(exp.description);
        return `<div class="entry">
        <div class="row"><span class="entry-title">${escapeHtml(exp.position)}</span><span class="entry-date">${escapeHtml(dateRange)}</span></div>
        ${sub ? `<div class="entry-sub">${sub}</div>` : ""}
        ${desc}
      </div>`;
      })
      .join("");
    sections.push(`<section><h2>Pengalaman Kerja</h2>${entries}</section>`);
  }

  if (data.education.length > 0) {
    const entries = data.education
      .map((edu) => {
        const dateRange = formatDateRange(edu.startDate, edu.endDate, false);
        const detail = joinNonEmpty(
          [escapeHtml(edu.degree), escapeHtml(edu.field)],
          " — "
        );
        const gpa = edu.gpa ? `IPK ${escapeHtml(edu.gpa)}` : "";
        const sub = joinNonEmpty([detail, gpa], " · ");
        return `<div class="entry">
        <div class="row"><span class="entry-title">${escapeHtml(edu.institution)}</span><span class="entry-date">${escapeHtml(dateRange)}</span></div>
        ${sub ? `<div class="entry-sub">${sub}</div>` : ""}
      </div>`;
      })
      .join("");
    sections.push(`<section><h2>Pendidikan</h2>${entries}</section>`);
  }

  if (data.skills.length > 0) {
    const items = data.skills
      .map((s) => `<span class="inline">${escapeHtml(s.name)}</span>`)
      .join("");
    sections.push(`<section><h2>Keahlian</h2><div>${items}</div></section>`);
  }

  if (data.projects.length > 0) {
    const entries = data.projects
      .map((proj) => {
        const title = joinNonEmpty(
          [escapeHtml(proj.name), escapeHtml(proj.url)],
          " — "
        );
        const desc = renderDescription(proj.description);
        return `<div class="entry"><div class="entry-title">${title}</div>${desc}</div>`;
      })
      .join("");
    sections.push(`<section><h2>Proyek</h2>${entries}</section>`);
  }

  if (data.certifications.length > 0) {
    const items = data.certifications
      .map((c) => {
        const parts = joinNonEmpty([c.name, c.issuer].map(escapeHtml), " — ");
        const date = c.date
          ? ` (${escapeHtml(formatDateRange(c.date, "", false))})`
          : "";
        return `<li>${parts}${date}</li>`;
      })
      .join("");
    sections.push(`<section><h2>Sertifikasi</h2><ul>${items}</ul></section>`);
  }

  if (data.languages.length > 0) {
    const items = data.languages
      .map((l) => {
        const prof = l.proficiency ? ` (${escapeHtml(l.proficiency)})` : "";
        return `<span class="inline">${escapeHtml(l.name)}${prof}</span>`;
      })
      .join("");
    sections.push(`<section><h2>Bahasa</h2><div>${items}</div></section>`);
  }

  data.customSections.forEach((cs) => {
    if (!cs.items.length) return;
    const items = cs.items
      .map((item) => {
        const heading = item.heading
          ? `<div class="entry-title">${escapeHtml(item.heading)}</div>`
          : "";
        const body = renderDescription(item.body);
        return `<div class="entry">${heading}${body}</div>`;
      })
      .join("");
    sections.push(
      `<section><h2>${escapeHtml(cs.title || "Lainnya")}</h2>${items}</section>`
    );
  });

  const body = `<main>${header}${sections.join("")}</main>`;
  return documentShell(personal.fullName, css, body);
}
