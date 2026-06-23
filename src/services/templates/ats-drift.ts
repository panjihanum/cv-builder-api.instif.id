import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";

const css = `
body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #525252; font-size: 10pt; font-weight: 300; line-height: 1.7; margin: 0; min-height: 100vh; padding: 56px 64px; }
header.header { border-bottom: 0.5pt solid #f5f5f5; padding-bottom: 16px; margin-bottom: 20px; }
header.header h1 { font-size: 22pt; font-weight: 100; letter-spacing: 1.5px; color: #171717; margin: 0 0 3px; }
header.header .role { font-size: 9.5pt; font-weight: 300; color: #a3a3a3; margin: 0 0 6px; }
header.header .contact { font-size: 8.5pt; font-weight: 300; color: #a3a3a3; margin: 0; }
.section { margin-bottom: 14px; }
.section h2 { font-size: 8.5pt; font-weight: 300; text-transform: uppercase; letter-spacing: 4px; color: #a3a3a3; border-bottom: 0.5pt solid #f5f5f5; padding-bottom: 3px; margin: 0 0 10px; }
.entry { margin-bottom: 12px; border-bottom: 0.5pt solid #fafafa; padding-bottom: 10px; }
.entry:last-child { border-bottom: none; padding-bottom: 0; }
.entry h3 { font-size: 10pt; margin: 0; font-weight: 400; color: #262626; }
.entry .meta { margin: 1px 0 3px; font-size: 9pt; font-weight: 300; color: #a3a3a3; }
.entry p { margin: 0; }
ul { margin: 3px 0 0; padding-left: 16px; color: #525252; font-weight: 300; }
li { margin-bottom: 1px; }
p { margin: 3px 0; }
strong { font-weight: 500; }
em { font-style: italic; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline; }
.inline-list li:not(:last-child)::after { content: "   ·   "; color: #d4d4d4; }
.level { display: none; }
`;

export function renderAtsDrift(data: CvData): string {
  const body = `<main>${renderHeader(data)}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
