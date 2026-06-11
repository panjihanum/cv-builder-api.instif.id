import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";

const css = `
body { font-family: Helvetica, Arial, sans-serif; color: #1f2937; font-size: 10.5pt; line-height: 1.5; margin: 0; }
.header { border-bottom: 2px solid #2563eb; padding-bottom: 10px; margin-bottom: 14px; }
.header h1 { font-size: 19pt; margin: 0 0 2px; color: #111827; }
.header .role { margin: 0 0 4px; font-size: 11.5pt; color: #2563eb; font-weight: 600; }
.header .contact { margin: 0; font-size: 9pt; color: #4b5563; }
.section { margin-bottom: 12px; }
.section h2 { font-size: 10.5pt; text-transform: uppercase; letter-spacing: 1px; color: #2563eb; border-left: 3px solid #2563eb; padding-left: 8px; margin: 0 0 6px; }
.entry { margin-bottom: 8px; }
.entry h3 { font-size: 10.5pt; margin: 0; color: #111827; }
.entry .meta { margin: 1px 0 3px; font-size: 9pt; color: #6b7280; }
.entry p { margin: 0; }
ul { margin: 0; padding-left: 18px; }
.inline-list { list-style: none; padding: 0; }
.inline-list li { display: inline-block; margin: 0 10px 3px 0; }
.level { color: #6b7280; }
`;

export function renderModernProfessional(data: CvData): string {
  const body = `<main>${renderHeader(data)}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body);
}
