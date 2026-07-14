import type { CvData } from "@/lib/cvData.js";
import {
  documentShell,
  escapeHtml,
  formatDateRange,
  joinNonEmpty,
  renderDescription,
  renderSummary,
} from "@/services/templates/shared.js";
import { renderAuroraSidebar } from "@/services/templates/aurora-sidebar.js";
import { getCvLabels } from "@/services/templates/i18n.js";

const css = `
* { box-sizing: border-box; }
/* Sidebar colour on the page background so the left column keeps its fill on
   page 2+ (Chrome doesn't repeat a grid item's background across a page break). */
body { font-family: Helvetica, Arial, sans-serif; color: #334155; font-size: 9.5pt; line-height: 1.5; margin: 0; background: linear-gradient(90deg, #6d28d9 0, #6d28d9 34%, #ffffff 34%, #ffffff 100%); }
.layout { display: grid; grid-template-columns: 34% 66%; min-height: 100vh; }
.sidebar { background: linear-gradient(160deg, #4338ca 0%, #6d28d9 55%, #7c3aed 100%); color: #ffffff; padding: 24px 18px; }
.sidebar .photo { width: 104px; height: 104px; border-radius: 50%; object-fit: cover; display: block; margin: 0 0 14px; border: 4px solid rgba(255, 255, 255, 0.25); }
.sidebar .s-name { font-size: 19pt; font-weight: 800; letter-spacing: -0.3px; line-height: 1.15; margin: 0 0 2px; color: #ffffff; }
.sidebar .s-role { margin: 0 0 4px; font-size: 10.5pt; font-weight: 500; color: #ede9fe; }
.sidebar h2 { font-size: 8pt; text-transform: uppercase; letter-spacing: 2px; margin: 18px 0 7px; padding-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.18); color: #ddd6fe; font-weight: 700; }
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
.entry ul, .entry ol { margin: 3px 0 0; padding-left: 16px; color: #475569; }
.edu-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.edu-head h3 { margin: 0; }
.edu-date { flex-shrink: 0; font-size: 8pt; font-weight: 600; color: #7c3aed; }
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
  const body = description || "";
  return `<article class="entry">${dateLine}<h3>${heading}</h3>${metaLine}${body}</article>`;
}

function renderExperienceSection(data: CvData): string {
  const t = getCvLabels(data.language);
  const entries = data.experience
    .map((experience) =>
      entry(
        escapeHtml(
          formatDateRange(
            experience.startDate,
            experience.endDate,
            experience.current,
            data.language
          )
        ),
        escapeHtml(experience.position),
        joinNonEmpty(
          [experience.company, experience.location].map(escapeHtml),
          ", "
        ),
        renderDescription(experience.description)
      )
    )
    .join("");
  return section(
    t.experience,
    entries ? `<div class="timeline">${entries}</div>` : ""
  );
}

function renderEducationSection(data: CvData): string {
  const t = getCvLabels(data.language);
  const entries = data.education
    .map((education) => {
      const date = escapeHtml(
        formatDateRange(
          education.startDate,
          education.endDate,
          false,
          data.language
        )
      );
      const dateEl = date ? `<span class="edu-date">${date}</span>` : "";
      const degreeField = joinNonEmpty(
        [education.degree, education.field].map(escapeHtml),
        " "
      );
      const gpa = education.gpa.trim()
        ? `${t.gpa} ${escapeHtml(education.gpa)}`
        : "";
      const meta = joinNonEmpty(
        [degreeField, gpa, escapeHtml(education.description)],
        ", "
      );
      const metaEl = meta ? `<p class="meta">${meta}</p>` : "";
      return `<article class="entry"><div class="edu-head"><h3>${escapeHtml(
        education.institution
      )}</h3>${dateEl}</div>${metaEl}</article>`;
    })
    .join("");
  return section(t.education, entries);
}

function renderProjectsSection(data: CvData): string {
  const t = getCvLabels(data.language);
  const entries = data.projects
    .map((project) =>
      entry(
        "",
        joinNonEmpty([project.name, project.url].map(escapeHtml), " &middot; "),
        "",
        renderDescription(project.description)
      )
    )
    .join("");
  return section(t.projects, entries);
}

function renderCustomSections(data: CvData): string {
  const t = getCvLabels(data.language);
  return data.customSections
    .map((custom) => {
      const items = custom.items
        .map((item) =>
          entry("", escapeHtml(item.heading), "", renderDescription(item.body))
        )
        .join("");
      return section(custom.title || t.other, items);
    })
    .join("");
}

function renderMain(data: CvData): string {
  const t = getCvLabels(data.language);
  const summary = data.summary.trim()
    ? section(t.summary, renderSummary(data.summary))
    : "";
  return [
    '<div class="main">',
    summary,
    renderExperienceSection(data),
    renderEducationSection(data),
    renderProjectsSection(data),
    renderCustomSections(data),
    "</div>",
  ].join("");
}

export function renderAurora(data: CvData): string {
  const body = `<main class="layout">${renderAuroraSidebar(data)}${renderMain(data)}</main>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
