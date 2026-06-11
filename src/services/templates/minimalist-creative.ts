import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";

const css = `
body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #262626; font-size: 10pt; line-height: 1.7; margin: 0; padding: 10px 6px; }
.header { margin-bottom: 28px; }
.header h1 { font-size: 24pt; font-weight: 300; letter-spacing: 3px; text-transform: uppercase; margin: 0 0 6px; }
.header .role { margin: 0 0 8px; font-size: 11pt; letter-spacing: 1.5px; text-transform: uppercase; color: #737373; }
.header .contact { margin: 0; font-size: 9pt; color: #737373; }
.section { margin-bottom: 22px; }
.section h2 { font-size: 9.5pt; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: #262626; margin: 0 0 10px; }
.entry { margin-bottom: 12px; }
.entry h3 { font-size: 10.5pt; font-weight: 600; margin: 0; }
.entry .meta { margin: 1px 0 4px; font-size: 9pt; color: #8c8c8c; }
.entry p { margin: 0; color: #404040; }
ul { margin: 0; padding-left: 16px; }
.inline-list { list-style: none; padding: 0; }
.inline-list li { display: inline-block; margin: 0 14px 4px 0; }
.level { color: #8c8c8c; }
`;

export function renderMinimalistCreative(data: CvData): string {
  const body = `<main>${renderHeader(data)}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body);
}
