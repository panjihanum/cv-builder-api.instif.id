import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";

const css = `
body { font-family: Arial, Helvetica, sans-serif; color: #374151; font-size: 10pt; line-height: 1.6; margin: 0; min-height: 100vh; padding: 44px 52px; }
header.header { border-bottom: 2pt solid #111827; padding-bottom: 12px; margin-bottom: 16px; }
header.header h1 { font-family: Georgia, "Times New Roman", serif; font-size: 21pt; font-weight: 700; color: #111827; margin: 0 0 3px; }
header.header .role { font-family: Georgia, "Times New Roman", serif; font-size: 10pt; font-style: italic; color: #4b5563; margin: 0 0 5px; }
header.header .contact { font-size: 8.5pt; color: #6b7280; margin: 0; }
.section { margin-bottom: 13px; }
.section h2 { font-family: Georgia, "Times New Roman", serif; font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #111827; border-left: 4pt solid #111827; padding-left: 8px; margin: 0 0 7px; }
.entry { margin-bottom: 9px; }
.entry h3 { font-size: 10pt; margin: 0; font-weight: 600; color: #111827; }
.entry .meta { margin: 1px 0 3px; font-size: 9pt; color: #6b7280; }
.entry p { margin: 0; }
ul { margin: 3px 0 0; padding-left: 16px; color: #374151; }
li { margin-bottom: 1px; }
p { margin: 3px 0; }
strong { font-weight: 700; }
em { font-style: italic; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline; }
.inline-list li:not(:last-child)::after { content: " · "; color: #9ca3af; }
.level { display: none; }
`;

export function renderAtsPillar(data: CvData): string {
  const body = `<main>${renderHeader(data)}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
