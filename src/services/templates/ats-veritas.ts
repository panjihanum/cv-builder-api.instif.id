import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";

const css = `
body { font-family: Georgia, "Times New Roman", serif; color: #374151; font-size: 10.5pt; line-height: 1.65; margin: 0; min-height: 100vh; padding: 48px 56px; }
header.header { text-align: center; border-bottom: 0.5pt solid #d1d5db; padding-bottom: 12px; margin-bottom: 16px; }
header.header h1 { font-size: 22pt; font-weight: 700; color: #111827; margin: 0 0 3px; }
header.header .role { font-size: 10pt; font-style: italic; font-weight: 300; color: #6b7280; margin: 0 0 5px; }
header.header .contact { font-size: 9pt; color: #6b7280; margin: 0; }
.section { margin-bottom: 13px; }
.section h2 { font-size: 9.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: #374151; margin: 0 0 6px; display: flex; align-items: center; gap: 8px; }
.section h2::after { content: ""; flex: 1; border-bottom: 0.5pt solid #d1d5db; }
.entry { margin-bottom: 9px; }
.entry h3 { font-size: 10.5pt; margin: 0; font-weight: 700; color: #111827; }
.entry .meta { margin: 1px 0 3px; font-size: 9.5pt; color: #6b7280; font-style: italic; }
.entry p { margin: 0; }
ul { margin: 3px 0 0; padding-left: 18px; color: #4b5563; }
li { margin-bottom: 1px; }
p { margin: 3px 0; }
strong { font-weight: 700; }
em { font-style: italic; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline; }
.inline-list li:not(:last-child)::after { content: "  ·  "; color: #9ca3af; }
.level { display: none; }
`;

export function renderAtsVeritas(data: CvData): string {
  const body = `<main>${renderHeader(data)}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
