import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";

const css = `
body { font-family: Arial, Helvetica, sans-serif; color: #374151; font-size: 9pt; line-height: 1.45; margin: 0; min-height: 100vh; padding: 28px 36px; }
header.header { padding-bottom: 5px; margin-bottom: 8px; }
header.header h1 { font-size: 16pt; font-weight: 700; color: #111827; margin: 0 0 1px; }
header.header .role { font-size: 8.5pt; color: #6b7280; margin: 0 0 3px; }
header.header .contact { font-size: 7.5pt; color: #6b7280; margin: 0; }
.section { margin-bottom: 8px; }
.section h2 { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #4b5563; border-bottom: 0.5pt solid #d1d5db; padding-bottom: 1px; margin: 0 0 4px; }
.entry { margin-bottom: 5px; }
.entry h3 { font-size: 9pt; margin: 0; font-weight: 600; color: #111827; }
.entry .meta { margin: 0 0 2px; font-size: 8pt; color: #6b7280; }
.entry p { margin: 0; }
ul { margin: 2px 0 0; padding-left: 14px; color: #374151; font-size: 8.5pt; }
li { margin-bottom: 0; }
p { margin: 2px 0; }
strong { font-weight: 700; }
em { font-style: italic; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline; }
.inline-list li:not(:last-child)::after { content: " · "; color: #9ca3af; }
.level { display: none; }
`;

export function renderAtsBrevity(data: CvData): string {
  const body = `<main>${renderHeader(data)}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
