import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";

const css = `
body { font-family: Helvetica, Arial, sans-serif; color: #374151; font-size: 9pt; line-height: 1.4; margin: 0; box-sizing: border-box; min-height: 100vh; padding: 36px 40px; }
.header { border-bottom: 1pt solid #cbd5e1; padding-bottom: 8px; margin-bottom: 11px; }
.header h1 { font-size: 18pt; margin: 0 0 1px; color: #0f172a; font-weight: 800; letter-spacing: -0.3px; }
.header .role { margin: 0 0 4px; font-size: 10pt; color: #475569; font-weight: 600; }
.header .contact { margin: 0; font-size: 8pt; color: #64748b; }
.section { margin-bottom: 9px; }
.section h2 { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 1.5px; color: #1e293b; border-left: 3px solid #334155; padding-left: 6px; margin: 0 0 5px; font-weight: 700; }
.entry { margin-bottom: 6px; }
.entry h3 { font-size: 9.5pt; margin: 0; color: #0f172a; font-weight: 700; }
.entry .meta { margin: 0 0 2px; font-size: 8.5pt; color: #64748b; }
.entry p { margin: 0; }
ul { margin: 2px 0 0; padding-left: 15px; color: #475569; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline; }
.inline-list li:not(:last-child)::after { content: ", "; }
.level { display: none; }
`;

export function renderAtsCompact(data: CvData): string {
  const body = `<main>${renderHeader(data)}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body);
}
