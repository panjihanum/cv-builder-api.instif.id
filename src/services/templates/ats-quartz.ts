import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";

const css = `
body { font-family: Helvetica, Arial, sans-serif; color: #1f2937; font-size: 9.5pt; line-height: 1.4; margin: 0; min-height: 100vh; padding: 36px 48px; }
header.header { border-bottom: 0.75pt solid #d1d5db; padding-bottom: 8px; margin-bottom: 10px; }
header.header h1 { font-size: 19pt; font-weight: 700; letter-spacing: 1.5px; color: #111; margin: 0 0 1px; }
header.header .role { font-size: 9pt; color: #6b7280; margin: 0 0 3px; }
header.header .contact { font-size: 8pt; color: #6b7280; margin: 0; }
.section { margin-bottom: 10px; }
.section h2 { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #374151; border-bottom: 0.5pt solid #e5e7eb; padding-bottom: 1px; margin: 0 0 5px; }
.entry { margin-bottom: 6px; }
.entry h3 { font-size: 9.5pt; margin: 0; font-weight: 600; }
.entry .meta { margin: 0 0 2px; font-size: 8.5pt; color: #6b7280; }
.entry p { margin: 0; }
ul { margin: 2px 0 0; padding-left: 14px; }
li { margin-bottom: 0; }
p { margin: 2px 0; }
strong { font-weight: 700; }
em { font-style: italic; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline; }
.inline-list li:not(:last-child)::after { content: " · "; color: #9ca3af; }
.level { display: none; }
`;

export function renderAtsQuartz(data: CvData): string {
  const body = `<main>${renderHeader(data)}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
