import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";

const css = `
body { font-family: Arial, Helvetica, sans-serif; color: #44403c; font-size: 10.5pt; line-height: 1.65; margin: 0; min-height: 100vh; padding: 48px 56px; background: #fafaf9; }
header.header { border-bottom: 0.75pt solid #d6d3d1; padding-bottom: 12px; margin-bottom: 16px; }
header.header h1 { font-size: 20pt; font-weight: 600; letter-spacing: -0.2px; color: #1c1917; margin: 0 0 2px; }
header.header .role { font-size: 9.5pt; font-weight: 400; color: #78716c; margin: 0 0 5px; }
header.header .contact { font-size: 8.5pt; color: #a8a29e; margin: 0; }
.section { margin-bottom: 14px; }
.section h2 { font-size: 9pt; font-weight: 500; text-transform: uppercase; letter-spacing: 3px; color: #a8a29e; margin: 0 0 8px; }
.entry { margin-bottom: 10px; }
.entry h3 { font-size: 10.5pt; margin: 0; font-weight: 600; color: #1c1917; }
.entry .meta { margin: 1px 0 3px; font-size: 9pt; color: #78716c; }
.entry p { margin: 0; }
ul { margin: 3px 0 0; padding-left: 16px; color: #44403c; }
li { margin-bottom: 1px; }
p { margin: 3px 0; }
strong { font-weight: 700; }
em { font-style: italic; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline; }
.inline-list li:not(:last-child)::after { content: "  ·  "; color: #d6d3d1; }
.level { display: none; }
`;

export function renderAtsHalcyon(data: CvData): string {
  const body = `<main>${renderHeader(data)}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
