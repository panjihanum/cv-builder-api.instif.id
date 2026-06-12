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
body { font-family: Helvetica, Arial, sans-serif; color: #1f2937; font-size: 9.5pt; line-height: 1.5; margin: 0; }
.layout { display: grid; grid-template-columns: 34% 66%; min-height: 100vh; }
.sidebar { background: linear-gradient(160deg, #4f46e5, #7c3aed); color: #ffffff; padding: 20px 14px; }
.sidebar .photo { width: 88px; height: 88px; border-radius: 50%; object-fit: cover; display: block; margin: 0 auto 14px; border: 2px solid rgba(255, 255, 255, 0.7); }
.sidebar h2 { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 2px; margin: 14px 0 6px; color: #e0e7ff; }
.sidebar h2:first-of-type { margin-top: 0; }
.sidebar ul { list-style: none; margin: 0; padding: 0; }
.sidebar li { margin-bottom: 4px; word-break: break-word; }
.skill-row { display: flex; justify-content: space-between; gap: 6px; }
.dots { letter-spacing: 2px; color: #c7d2fe; white-space: nowrap; }
.main { padding: 20px 18px; }
.main h1 { font-size: 19pt; font-weight: 700; margin: 0 0 2px; color: #111827; }
.main .role { margin: 0 0 14px; font-size: 11pt; font-weight: 600; color: #6d28d9; }
.section { margin-bottom: 13px; }
.section h2 { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 2.5px; color: #6d28d9; margin: 0 0 6px; }
.timeline { border-left: 1px solid #ddd6fe; padding-left: 12px; }
.timeline .entry { position: relative; }
.timeline .entry::before { content: ""; position: absolute; left: -14.5px; top: 4px; width: 5px; height: 5px; border-radius: 50%; background: #7c3aed; }
.entry { margin-bottom: 9px; }
.entry h3 { font-size: 10pt; margin: 0; color: #111827; }
.entry .date { margin: 0 0 1px; font-size: 8pt; font-weight: 600; color: #7c3aed; }
.entry .meta { margin: 1px 0 2px; font-size: 8.5pt; color: #6b7280; }
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
