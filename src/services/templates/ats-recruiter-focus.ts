import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderCertificationsSection,
  renderCustomSections,
  renderEducationSection,
  renderExperienceSection,
  renderHeader,
  renderLanguagesSection,
  renderProjectsSection,
  renderSkillsSection,
  renderSummarySection,
} from "@/services/templates/sections.js";

const css = `
body { font-family: Helvetica, Arial, sans-serif; color: #334155; font-size: 10pt; line-height: 1.5; margin: 0; box-sizing: border-box; min-height: 100vh; padding: 40px 44px; }
.header { border-left: 4px solid #2563eb; background: #f8fafc; padding: 14px 18px; margin-bottom: 15px; }
.header h1 { font-size: 20pt; margin: 0 0 2px; color: #0f172a; font-weight: 800; letter-spacing: -0.3px; }
.header .role { margin: 0 0 6px; font-size: 11pt; color: #1d4ed8; font-weight: 600; }
.header .contact { margin: 0; font-size: 8.5pt; color: #64748b; }
.section { margin-bottom: 13px; }
.section h2 { font-size: 9.5pt; text-transform: uppercase; letter-spacing: 1.5px; color: #1e40af; border-bottom: 2px solid #bfdbfe; padding-bottom: 3px; margin: 0 0 7px; font-weight: 700; }
.entry { margin-bottom: 9px; }
.entry h3 { font-size: 10.5pt; margin: 0; color: #0f172a; font-weight: 700; }
.entry .meta { margin: 1px 0 3px; font-size: 9pt; color: #1d4ed8; font-weight: 500; }
.entry p { margin: 0; }
ul { margin: 3px 0 0; padding-left: 17px; color: #475569; }
.inline-list { list-style: none; padding: 0; margin: 0; font-weight: 500; color: #1e293b; }
.inline-list li { display: inline; }
.inline-list li:not(:last-child)::after { content: "  \\00b7  "; }
.level { display: none; }
`;

export function renderAtsRecruiterFocus(data: CvData): string {
  // Core competencies (skills) are surfaced right after the summary to maximize
  // ATS keyword matching, then the rest of the sections follow in order.
  const body = `<main>${renderHeader(data)}${renderSummarySection(data)}${renderSkillsSection(
    data
  )}${renderExperienceSection(data)}${renderEducationSection(
    data
  )}${renderProjectsSection(data)}${renderCertificationsSection(
    data
  )}${renderLanguagesSection(data)}${renderCustomSections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
