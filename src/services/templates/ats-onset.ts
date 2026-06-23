import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";

const css = `
body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; font-size: 10pt; line-height: 1.55; margin: 0; min-height: 100vh; padding: 40px 48px; }
header.header { padding-bottom: 8px; margin-bottom: 12px; }
header.header h1 { font-size: 19pt; font-weight: 700; color: #111827; margin: 0 0 2px; }
header.header .role { font-size: 9.5pt; font-weight: 600; color: #3b82f6; margin: 0 0 4px; }
header.header .contact { font-size: 8.5pt; color: #6b7280; margin: 0; }
.section { margin-bottom: 11px; }
.section h2 { font-size: 9.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #3b82f6; border-bottom: 2pt solid #3b82f6; padding-bottom: 2px; margin: 0 0 6px; }
.entry { margin-bottom: 8px; }
.entry h3 { font-size: 10pt; margin: 0; font-weight: 700; color: #111827; }
.entry .meta { margin: 1px 0 3px; font-size: 9pt; color: #6b7280; }
.entry p { margin: 0; }
ul { margin: 3px 0 0; padding-left: 16px; }
li { margin-bottom: 1px; }
p { margin: 3px 0; }
strong { font-weight: 700; }
em { font-style: italic; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline; }
.inline-list li:not(:last-child)::after { content: " · "; color: #9ca3af; }
.level { display: none; }
`;

export function renderAtsOnset(data: CvData): string {
  const body = `<main>${renderHeader(data)}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
