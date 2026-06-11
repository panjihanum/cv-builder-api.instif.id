import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";

const css = `
body { font-family: Georgia, "Times New Roman", serif; color: #111; font-size: 11pt; line-height: 1.45; margin: 0; }
.header { margin-bottom: 14px; }
.header h1 { font-size: 20pt; margin: 0 0 2px; }
.header .role { margin: 0 0 4px; font-size: 12pt; }
.header .contact { margin: 0; font-size: 9.5pt; color: #333; }
.section { margin-bottom: 12px; }
.section h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 0.6px; border-bottom: 1px solid #111; padding-bottom: 2px; margin: 0 0 6px; }
.entry { margin-bottom: 8px; }
.entry h3 { font-size: 10.5pt; margin: 0; }
.entry .meta { margin: 1px 0 3px; font-size: 9.5pt; color: #444; }
.entry p { margin: 0; }
ul { margin: 0; padding-left: 18px; }
.inline-list { list-style: none; padding: 0; }
.inline-list li { display: inline; }
.inline-list li:not(:last-child)::after { content: " \\00b7 "; }
`;

export function renderClassicAts(data: CvData): string {
  const body = `<main>${renderHeader(data)}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body);
}
