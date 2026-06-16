import type { CvData } from "@/lib/cvData.js";
import {
  documentShell,
  escapeHtml,
  formatDateRange,
  joinNonEmpty,
  renderMultiline,
} from "@/services/templates/shared.js";
import { renderAuroraSidebar } from "@/services/templates/aurora-sidebar.js";

const css = `
* { box-sizing: border-box; }
/* Sidebar colour on the page background so the left column keeps its fill on
   page 2+ (Chrome doesn't repeat a grid item's background across a page break). */
body { font-family: Helvetica, Arial, sans-serif; color: #334155; font-size: 9.5pt; line-height: 1.5; margin: 0; background: linear-gradient(90deg, #6d28d9 0, #6d28d9 34%, #ffffff 34%, #ffffff 100%); }
.layout { display: grid; grid-template-columns: 34% 66%; min-height: 100vh; }
.sidebar { background: linear-gradient(160deg, #4338ca 0%, #6d28d9 55%, #7c3aed 100%); color: #ffffff; padding: 24px 18px; }
.sidebar .photo { width: 96px; height: 96px; border-radius: 50%; object-fit: cover; display: block; margin: 0 auto 16px; border: 3px solid rgba(255, 255, 255, 0.35); }
.sidebar h2 { font-size: 8pt; text-transform: uppercase; letter-spacing: 2px; margin: 16px 0 7px; padding-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.18); color: #ddd6fe; font-weight: 700; }
.sidebar h2:first-of-type { margin-top: 0; }
.sidebar ul { list-style: none; margin: 0; padding: 0; }
.sidebar li { margin-bottom: 5px; word-break: break-word; }
.skill-row { display: flex; justify-content: space-between; gap: 6px; }
.dots { letter-spacing: 2px; color: #c7d2fe; white-space: nowrap; }
.main { padding: 24px 24px; }
.main h1 { font-size: 21pt; font-weight: 800; margin: 0 0 2px; color: #0f172a; letter-spacing: -0.3px; }
.main .role { margin: 0 0 16px; font-size: 11pt; font-weight: 600; color: #6d28d9; }
.section { margin-bottom: 14px; }
.section h2 { display: flex; align-items: center; gap: 9px; font-size: 8.5pt; text-transform: uppercase; letter-spacing: 2.5px; color: #6d28d9; margin: 0 0 8px; font-weight: 700; }
.section h2::before { content: ""; width: 4px; height: 13px; border-radius: 999px; background: linear-gradient(180deg,#6366f1,#7c3aed); }
.timeline { border-left: 1.5px solid #ddd6fe; padding-left: 14px; }
.timeline .entry { position: relative; }
.timeline .entry::before { content: ""; position: absolute; left: -19px; top: 4px; width: 7px; height: 7px; border-radius: 50%; background: #7c3aed; border: 2px solid #ede9fe; }
.entry { margin-bottom: 10px; }
.entry h3 { font-size: 10pt; margin: 0; color: #0f172a; font-weight: 700; }
.entry .date { margin: 0 0 1px; font-size: 8pt; font-weight: 600; color: #7c3aed; }
.entry .meta { margin: 1px 0 2px; font-size: 8.5pt; color: #64748b; }
.entry p { margin: 0; }
`;

function section(title: string, content: string): string {
  if (!content) return "";
  return `<section class="section"><h2>${escapeHtml(title)}</h2>${content}</section>`;
}

function entry(
  date: string,
  heading: string,
  meta: string,
  description: string
): string {
  const dateLine = date ? `<p class="date">${date}</p>` : "";
  const metaLine = meta ? `<p class="meta">${meta}</p>` : "";
  const body = description ? `<p>${description}</p>` : "";
  return `<article class="entry">${dateLine}<h3>${heading}</h3>${metaLine}${body}</article>`;
}

function renderExperienceSection(data: CvData): string {
  const entries = data.experience
    .map((experience) =>
      entry(
        escapeHtml(
          formatDateRange(
            experience.startDate,
            experience.endDate,
            experience.current
          )
        ),
        joinNonEmpty(
          [experience.position, experience.company].map(escapeHtml),
          " &mdash; "
        ),
        escapeHtml(experience.location),
        experience.description.trim()
          ? renderMultiline(experience.description)
          : ""
      )
    )
    .join("");
  return section(
    "Pengalaman",
    entries ? `<div class="timeline">${entries}</div>` : ""
  );
}

function renderEducationSection(data: CvData): string {
  const entries = data.education
    .map((education) => {
      const gpa = education.gpa.trim()
        ? `GPA ${escapeHtml(education.gpa)}`
        : "";
      return entry(
        escapeHtml(
          formatDateRange(education.startDate, education.endDate, false)
        ),
        escapeHtml(education.institution),
        joinNonEmpty(
          [
            joinNonEmpty(
              [education.degree, education.field].map(escapeHtml),
              ", "
            ),
            gpa,
          ],
          " &middot; "
        ),
        education.description.trim()
          ? renderMultiline(education.description)
          : ""
      );
    })
    .join("");
  return section("Pendidikan", entries);
}

function renderProjectsSection(data: CvData): string {
  const entries = data.projects
    .map((project) =>
      entry(
        "",
        joinNonEmpty([project.name, project.url].map(escapeHtml), " &middot; "),
        "",
        project.description.trim() ? renderMultiline(project.description) : ""
      )
    )
    .join("");
  return section("Proyek", entries);
}

function renderCertificationsSection(data: CvData): string {
  const entries = data.certifications
    .map((certification) =>
      joinNonEmpty(
        [certification.name, certification.issuer, certification.date].map(
          escapeHtml
        ),
        " &middot; "
      )
    )
    .filter((item) => item.length > 0)
    .map((item) => `<article class="entry"><h3>${item}</h3></article>`)
    .join("");
  return section("Sertifikasi", entries);
}

function renderCustomSections(data: CvData): string {
  return data.customSections
    .map((custom) => {
      const items = custom.items
        .map((item) =>
          entry(
            "",
            escapeHtml(item.heading),
            "",
            item.body.trim() ? renderMultiline(item.body) : ""
          )
        )
        .join("");
      return section(custom.title || "Lainnya", items);
    })
    .join("");
}

function renderMain(data: CvData): string {
  const role = data.personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(data.personal.jobTitle)}</p>`
    : "";
  const summary = data.summary.trim()
    ? section("Ringkasan", `<p>${renderMultiline(data.summary)}</p>`)
    : "";
  return [
    `<div class="main"><h1>${escapeHtml(data.personal.fullName)}</h1>`,
    role,
    summary,
    renderExperienceSection(data),
    renderEducationSection(data),
    renderProjectsSection(data),
    renderCertificationsSection(data),
    renderCustomSections(data),
    "</div>",
  ].join("");
}

export function renderAurora(data: CvData): string {
  const body = `<main class="layout">${renderAuroraSidebar(data)}${renderMain(data)}</main>`;
  return documentShell(data.personal.fullName, css, body);
}
