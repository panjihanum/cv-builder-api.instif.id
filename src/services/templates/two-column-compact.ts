import type { CvData } from "@/lib/cvData.js";
import { documentShell, escapeHtml } from "@/services/templates/shared.js";
import {
  renderContactLine,
  renderCustomSections,
  renderEducationSection,
  renderExperienceSection,
  renderCertificationsSection,
  renderLanguageItems,
  renderProjectsSection,
  renderSkillItems,
  renderSummarySection,
} from "@/services/templates/sections.js";
import { renderPhoto } from "@/services/templates/photo.js";

const css = `
body { font-family: Helvetica, Arial, sans-serif; color: #1f2937; font-size: 9.5pt; line-height: 1.45; margin: 0; }
.layout { display: grid; grid-template-columns: 32% 68%; column-gap: 14px; }
.sidebar { background: #f3f4f6; padding: 12px; border-radius: 4px; }
.sidebar .photo { width: 84px; height: 84px; border-radius: 50%; object-fit: cover; display: block; margin: 0 auto 10px; }
.sidebar h2 { font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.8px; margin: 12px 0 4px; color: #111827; }
.sidebar h2:first-child { margin-top: 0; }
.sidebar ul { margin: 0; padding-left: 14px; }
.main h1 { font-size: 18pt; margin: 0 0 2px; color: #111827; }
.main .role { margin: 0 0 10px; font-size: 11pt; color: #374151; font-weight: 600; }
.section { margin-bottom: 10px; }
.section h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid #9ca3af; padding-bottom: 2px; margin: 0 0 5px; }
.entry { margin-bottom: 7px; }
.entry h3 { font-size: 10pt; margin: 0; }
.entry .meta { margin: 1px 0 2px; font-size: 8.5pt; color: #6b7280; }
.entry p { margin: 0; }
.level { color: #6b7280; }
`;

function renderSidebar(data: CvData): string {
  const contact = renderContactLine(data);
  const contactBlock = contact ? `<h2>Contact</h2><p>${contact}</p>` : "";
  const skillItems = renderSkillItems(data);
  const skillsBlock = skillItems ? `<h2>Skills</h2><ul>${skillItems}</ul>` : "";
  const languageItems = renderLanguageItems(data);
  const languagesBlock = languageItems
    ? `<h2>Languages</h2><ul>${languageItems}</ul>`
    : "";
  const photo = renderPhoto(data.personal.photoUrl);
  return `<aside class="sidebar">${photo}${contactBlock}${skillsBlock}${languagesBlock}</aside>`;
}

function renderMain(data: CvData): string {
  const role = data.personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(data.personal.jobTitle)}</p>`
    : "";
  return [
    `<div class="main"><h1>${escapeHtml(data.personal.fullName)}</h1>`,
    role,
    renderSummarySection(data),
    renderExperienceSection(data),
    renderEducationSection(data),
    renderProjectsSection(data),
    renderCertificationsSection(data),
    renderCustomSections(data),
    "</div>",
  ].join("");
}

export function renderTwoColumnCompact(data: CvData): string {
  const body = `<main class="layout">${renderSidebar(data)}${renderMain(data)}</main>`;
  return documentShell(data.personal.fullName, css, body);
}
