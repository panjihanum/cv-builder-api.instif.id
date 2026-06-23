import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";

const css = `
body { font-family: Helvetica Neue, Helvetica, Arial, sans-serif; color: #374151; font-size: 10.5pt; line-height: 1.65; margin: 0; min-height: 100vh; padding: 56px 64px; }
header.header { padding-bottom: 16px; margin-bottom: 10px; }
header.header h1 { font-size: 24pt; font-weight: 300; color: #111827; margin: 0 0 3px; letter-spacing: 0.5px; }
header.header .role { font-size: 10.5pt; font-weight: 400; color: #9ca3af; margin: 0 0 4px; }
header.header .contact { font-size: 9pt; color: #9ca3af; margin: 0; }
.section { margin-bottom: 20px; }
.section h2 { font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 4px; color: #9ca3af; margin: 0 0 8px; }
.entry { margin-bottom: 10px; }
.entry h3 { font-size: 11pt; margin: 0; font-weight: 600; color: #111827; }
.entry .meta { margin: 1px 0 3px; font-size: 9pt; color: #9ca3af; }
.entry p { margin: 0; }
ul { margin: 3px 0 0; padding-left: 18px; color: #6b7280; }
li { margin-bottom: 1px; }
p { margin: 3px 0; }
strong { font-weight: 700; }
em { font-style: italic; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline; }
.inline-list li:not(:last-child)::after { content: "  ·  "; color: #9ca3af; }
.level { display: none; }
`;

export function renderAtsLumen(data: CvData): string {
  const body = `<main>${renderHeader(data)}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
