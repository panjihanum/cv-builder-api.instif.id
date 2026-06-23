import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";

const css = `
body { font-family: Arial, Helvetica, sans-serif; color: #111827; font-size: 10.5pt; line-height: 1.55; margin: 0; min-height: 100vh; padding: 44px 52px; }
header.header { border-bottom: 3pt solid #111827; padding-bottom: 10px; margin-bottom: 14px; }
header.header h1 { font-size: 22pt; font-weight: 900; color: #111827; margin: 0 0 2px; }
header.header .role { font-size: 10pt; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: #4b5563; margin: 0 0 4px; }
header.header .contact { font-size: 9pt; color: #4b5563; margin: 0; }
.section { margin-bottom: 12px; }
.section h2 { font-size: 10pt; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; color: #111827; border-bottom: 2pt solid #111827; padding-bottom: 2px; margin: 0 0 7px; }
.entry { margin-bottom: 9px; }
.entry h3 { font-size: 10.5pt; margin: 0; font-weight: 700; color: #111827; }
.entry .meta { margin: 1px 0 3px; font-size: 9.5pt; font-weight: 600; color: #4b5563; }
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

export function renderAtsFoundry(data: CvData): string {
  const body = `<main>${renderHeader(data)}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
