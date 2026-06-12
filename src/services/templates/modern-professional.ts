import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";

const css = `
body { font-family: Helvetica, Arial, sans-serif; color: #334155; font-size: 10pt; line-height: 1.5; margin: 0; }
.header { border-bottom: 2px solid #4f46e5; padding-bottom: 11px; margin-bottom: 16px; }
.header h1 { font-size: 22pt; margin: 0 0 3px; color: #0f172a; font-weight: 800; letter-spacing: -0.3px; }
.header .role { margin: 0 0 6px; font-size: 11.5pt; color: #4338ca; font-weight: 600; }
.header .contact { margin: 0; font-size: 8.5pt; color: #64748b; }
.section { margin-bottom: 14px; }
.section h2 { font-size: 9.5pt; text-transform: uppercase; letter-spacing: 2px; color: #4338ca; border-bottom: 1px solid #e0e7ff; padding-bottom: 4px; margin: 0 0 8px; font-weight: 700; }
.entry { margin-bottom: 9px; }
.entry h3 { font-size: 10.5pt; margin: 0; color: #0f172a; font-weight: 700; }
.entry .meta { margin: 1px 0 3px; font-size: 9pt; color: #64748b; font-weight: 500; }
.entry p { margin: 0; }
ul { margin: 3px 0 0; padding-left: 17px; color: #475569; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline-block; margin: 0 6px 5px 0; background: #eef2ff; color: #4338ca; border: 1px solid #e0e7ff; border-radius: 5px; padding: 2px 9px; font-size: 8.5pt; font-weight: 600; }
.level { color: #818cf8; font-weight: 400; }
`;

export function renderModernProfessional(data: CvData): string {
  const body = `<main>${renderHeader(data)}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body);
}
