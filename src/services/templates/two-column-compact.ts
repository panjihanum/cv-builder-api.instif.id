import type { CvData } from "@/lib/cvData.js";
import {
  documentShell,
  escapeHtml,
  formatDateRange,
  joinNonEmpty,
} from "@/services/templates/shared.js";
import {
  renderCustomSections,
  renderEducationSection,
  renderExperienceSection,
  renderProjectsSection,
  renderSummarySection,
} from "@/services/templates/sections.js";
import { renderPhoto } from "@/services/templates/photo.js";
import { getCvLabels } from "@/services/templates/i18n.js";
import { renderSkillGroups } from "@/services/templates/skills.js";

const css = `
* { box-sizing: border-box; }
/* Sidebar colour on the page background so the left column keeps its fill on
   page 2+ (Chrome doesn't repeat a grid item's background across a page break). */
body { font-family: Helvetica, Arial, sans-serif; color: #334155; font-size: 9.5pt; line-height: 1.5; margin: 0; background: linear-gradient(90deg, #0f172a 0, #0f172a 31%, #ffffff 31%, #ffffff 100%); }
.layout { display: grid; grid-template-columns: 31% 69%; min-height: 100vh; }
.sidebar { background: #0f172a; color: #cbd5e1; padding: 24px 18px; }
.sidebar .photo { width: 92px; height: 92px; border-radius: 50%; object-fit: cover; display: block; margin: 0 0 12px; border: 2px solid rgba(34,211,238,0.4); }
.sidebar h1 { margin: 0; font-size: 16pt; font-weight: 700; color: #ffffff; line-height: 1.2; }
.sidebar .role { margin: 3px 0 0; font-size: 9.5pt; font-weight: 500; color: #67e8f9; }
.s-h { margin: 18px 0 7px; padding-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.1); font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.6px; color: #67e8f9; }
.s-list { list-style: none; margin: 0; padding: 0; font-size: 8.5pt; }
.s-list li { margin-bottom: 5px; word-break: break-word; }
.bar-row { margin-bottom: 8px; }
.bar-row .lbl { font-size: 8.5pt; color: #e2e8f0; margin-bottom: 3px; }
.bar { height: 5px; width: 100%; background: rgba(255,255,255,0.15); border-radius: 999px; }
.bar > span { display: block; height: 5px; border-radius: 999px; background: linear-gradient(90deg,#22d3ee,#38bdf8); }
.cert { margin-bottom: 6px; }
.cert .nm { font-weight: 600; color: #f1f5f9; }
.cert .ds { color: #94a3b8; }
.main { padding: 24px 24px; }
.section { margin-bottom: 13px; }
.section h2 { font-size: 9.5pt; text-transform: uppercase; letter-spacing: 1.6px; color: #0f172a; font-weight: 700; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 7px; }
.entry { margin-bottom: 8px; }
.entry h3 { font-size: 10pt; margin: 0; color: #0f172a; font-weight: 700; }
.entry .meta { margin: 1px 0 2px; font-size: 8.5pt; color: #64748b; }
.entry p { margin: 0; }
.entry ul { margin: 3px 0 0; padding-left: 16px; color: #475569; }
p { margin: 0; }
`;

function clampLevel(level: number): number {
  return Math.min(Math.max(level, 1), 5);
}

function renderSidebar(data: CvData): string {
  const t = getCvLabels(data.language);
  const { personal } = data;
  const photo = renderPhoto(personal.photoUrl);
  const role = personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(personal.jobTitle)}</p>`
    : "";

  const contactItems = [
    escapeHtml(personal.email),
    escapeHtml(personal.phone),
    escapeHtml(personal.address),
    ...personal.links.map((link) =>
      joinNonEmpty([link.label, link.url].map(escapeHtml), ": ")
    ),
  ]
    .filter((part) => part.trim().length > 0)
    .map((part) => `<li>${part}</li>`)
    .join("");
  const contactBlock = contactItems
    ? `<div class="s-h">${t.contact}</div><ul class="s-list">${contactItems}</ul>`
    : "";

  const skills = renderSkillGroups(
    data.skills,
    (skill) =>
      skill.name.trim().length > 0
        ? `<div class="bar-row"><div class="lbl">${escapeHtml(
            skill.name
          )}</div><div class="bar"><span style="width:${
            (clampLevel(skill.level) / 5) * 100
          }%"></span></div></div>`
        : "",
    { groupTag: "div" }
  );
  const skillsBlock = skills
    ? `<div class="s-h">${t.skills}</div>${skills}`
    : "";

  const languages = data.languages
    .filter((language) => language.name.trim().length > 0)
    .map(
      (language) =>
        `<li>${escapeHtml(language.name)}${
          language.proficiency ? ` (${escapeHtml(language.proficiency)})` : ""
        }</li>`
    )
    .join("");
  const langBlock = languages
    ? `<div class="s-h">${t.languages}</div><ul class="s-list">${languages}</ul>`
    : "";

  const certs = data.certifications
    .map((certification) => {
      const name = escapeHtml(certification.name);
      if (!name) return "";
      const detail = joinNonEmpty(
        [
          escapeHtml(certification.issuer),
          escapeHtml(
            formatDateRange(certification.date, "", false, data.language)
          ),
        ],
        " · "
      );
      return `<div class="cert"><div class="nm">${name}</div>${
        detail ? `<div class="ds">${detail}</div>` : ""
      }</div>`;
    })
    .join("");
  const certBlock = certs
    ? `<div class="s-h">${t.certifications}</div>${certs}`
    : "";

  return `<aside class="sidebar">${photo}<h1>${escapeHtml(
    personal.fullName
  )}</h1>${role}${contactBlock}${skillsBlock}${langBlock}${certBlock}</aside>`;
}

function renderMain(data: CvData): string {
  return [
    '<div class="main">',
    renderSummarySection(data),
    renderExperienceSection(data),
    renderEducationSection(data),
    renderProjectsSection(data),
    renderCustomSections(data),
    "</div>",
  ].join("");
}

export function renderTwoColumnCompact(data: CvData): string {
  const body = `<div class="layout">${renderSidebar(data)}${renderMain(data)}</div>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
