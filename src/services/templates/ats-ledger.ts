import type { CvData } from "@/lib/cvData.js";
import {
  documentShell,
  escapeHtml,
  renderSummary,
} from "@/services/templates/shared.js";
import {
  renderContactLine,
  renderExperienceSection,
  renderEducationSection,
  renderSkillsSection,
  renderProjectsSection,
  renderCertificationsSection,
  renderLanguagesSection,
  renderCustomSections,
} from "@/services/templates/sections.js";
import { getCvLabels } from "@/services/templates/i18n.js";

const css = `
body { font-family: Georgia, "Times New Roman", serif; color: #1f2937; font-size: 10.5pt; line-height: 1.6; margin: 0; min-height: 100vh; padding: 48px 56px; }
header.header { text-align: center; padding-bottom: 14px; margin-bottom: 16px; }
header.header h1 { font-size: 22pt; font-weight: 700; letter-spacing: 1.5px; color: #111827; margin: 0 0 3px; }
header.header .role { font-size: 10pt; color: #4b5563; margin: 0 0 6px; }
hr.double-rule { width: 75%; margin: 6px auto; border: none; border-top: 3pt double #1f2937; }
header.header .contact { font-size: 9pt; color: #4b5563; margin: 0; }
.section { margin-bottom: 13px; }
.section h2 { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #1f2937; border-bottom: 0.75pt solid #6b7280; padding-bottom: 3px; margin: 0 0 7px; }
.entry { margin-bottom: 9px; }
.entry h3 { font-size: 10.5pt; margin: 0; font-weight: 700; color: #111827; }
.entry .meta { margin: 1px 0 3px; font-size: 9.5pt; color: #6b7280; font-style: italic; }
.entry p { margin: 0; }
ul { margin: 3px 0 0; padding-left: 18px; color: #374151; }
li { margin-bottom: 1px; }
p { margin: 3px 0; }
strong { font-weight: 700; }
em { font-style: italic; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline; }
.inline-list li:not(:last-child)::after { content: " · "; color: #9ca3af; }
.level { display: none; }
`;

export function renderAtsLedger(data: CvData): string {
  const { personal } = data;
  const t = getCvLabels(data.language);
  const name = escapeHtml(personal.fullName);
  const role = personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(personal.jobTitle)}</p>`
    : "";
  const contact = renderContactLine(data);
  const contactLine = contact ? `<p class="contact">${contact}</p>` : "";

  const header = `<header class="header">
    <h1>${name}</h1>
    ${role}
    <hr class="double-rule" />
    ${contactLine}
  </header>`;

  const summarySection = data.summary.trim()
    ? `<section class="section"><h2>${escapeHtml(t.summary)}</h2>${renderSummary(data.summary)}</section>`
    : "";

  const sections = [
    summarySection,
    renderExperienceSection(data),
    renderEducationSection(data),
    renderSkillsSection(data),
    renderProjectsSection(data),
    renderCertificationsSection(data),
    renderLanguagesSection(data),
    renderCustomSections(data),
  ].join("");

  const body = `<main>${header}${sections}</main>`;
  return documentShell(personal.fullName, css, body, data.language);
}
