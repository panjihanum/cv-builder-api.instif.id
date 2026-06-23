import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";

const css = `
body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 10pt; line-height: 1.55; margin: 0; min-height: 100vh; padding: 44px 52px; }
header.header { border-bottom: 1.5pt solid #e5e7eb; padding-bottom: 10px; margin-bottom: 14px; }
header.header h1 { font-size: 22pt; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; color: #111; margin: 0 0 2px; }
header.header .role { font-size: 9.5pt; font-weight: 600; color: #1e3a5f; margin: 0 0 4px; }
header.header .contact { font-size: 8.5pt; color: #555; margin: 0; }
.section { margin-bottom: 12px; }
.section h2 { font-size: 9pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2.5px; color: #1e3a5f; border-bottom: 0.75pt solid #1e3a5f; padding-bottom: 2px; margin: 0 0 6px; }
.entry { margin-bottom: 8px; }
.entry h3 { font-size: 10pt; margin: 0; font-weight: 600; color: #111; }
.entry .meta { margin: 1px 0 3px; font-size: 9pt; color: #555; }
.entry p { margin: 0; }
ul { margin: 3px 0 0; padding-left: 16px; }
li { margin-bottom: 1px; }
p { margin: 3px 0; }
strong { font-weight: 700; }
em { font-style: italic; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline; }
.inline-list li:not(:last-child)::after { content: " · "; color: #888; }
.level { display: none; }
`;

export function renderAtsBeacon(data: CvData): string {
  const body = `<main>${renderHeader(data)}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
