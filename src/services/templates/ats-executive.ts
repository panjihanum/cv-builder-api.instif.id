import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";

const css = `
body { font-family: Georgia, "Times New Roman", serif; color: #334155; font-size: 10.5pt; line-height: 1.55; margin: 0; box-sizing: border-box; min-height: 100vh; padding: 48px 56px; }
.header { text-align: center; padding-bottom: 10px; margin-bottom: 14px; }
.header h1 { font-size: 21pt; margin: 0 0 4px; color: #0f172a; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
.header .role { margin: 0 0 6px; font-size: 10pt; text-transform: uppercase; letter-spacing: 3px; color: #64748b; font-weight: 600; }
.header .contact { margin: 0; font-size: 9pt; color: #475569; }
.section { margin-bottom: 13px; }
.section h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: 3px; text-align: center; color: #0f172a; font-weight: 700; margin: 0 0 8px; border-top: 0.75pt solid #cbd5e1; border-bottom: 0.75pt solid #cbd5e1; padding: 4px 0; }
.section > p { text-align: center; }
.entry { margin-bottom: 9px; }
.entry h3 { font-size: 10.5pt; margin: 0; color: #0f172a; font-weight: 700; }
.entry .meta { margin: 1px 0 3px; font-size: 9.5pt; color: #64748b; font-style: italic; }
.entry p { margin: 0; }
ul { margin: 3px 0 0; padding-left: 18px; color: #475569; }
.inline-list { list-style: none; padding: 0; margin: 0; text-align: center; }
.inline-list li { display: inline; }
.inline-list li:not(:last-child)::after { content: " \\00b7 "; }
.level { display: none; }
`;

export function renderAtsExecutive(data: CvData): string {
  const body = `<main>${renderHeader(data)}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body);
}
