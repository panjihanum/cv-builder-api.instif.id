import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";
import { renderPhoto } from "@/services/templates/photo.js";

const css = `
* { box-sizing: border-box; }
body { font-family: Helvetica, Arial, sans-serif; color: #334155; font-size: 10pt; line-height: 1.55; margin: 0; min-height: 100vh; padding: 44px 48px; }
.header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 18px; border-bottom: 3px solid #064e3b; padding-bottom: 12px; margin-bottom: 16px; }
.header-row .header { flex: 1; }
.photo { width: 84px; height: 84px; border-radius: 50%; object-fit: cover; flex-shrink: 0; border: 2px solid #064e3b; }
.header { margin: 0; }
.header h1 { font-size: 22pt; margin: 0 0 3px; letter-spacing: -0.3px; color: #052e2b; font-weight: 800; }
.header .role { margin: 0 0 6px; font-size: 11.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #047857; }
.header .contact { margin: 0; font-size: 9pt; color: #64748b; }
.section { margin-bottom: 15px; }
.section h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: 2px; color: #064e3b; font-weight: 700; border-bottom: 1px solid #d1fae5; padding-bottom: 4px; margin: 0 0 9px; }
.entry { margin-bottom: 11px; padding-left: 14px; border-left: 2px solid #a7f3d0; position: relative; }
.entry::before { content: ""; position: absolute; left: -5px; top: 5px; width: 8px; height: 8px; border-radius: 50%; background: #065f46; }
.entry h3 { font-size: 10.5pt; margin: 0; font-weight: 700; color: #052e2b; }
.entry .meta { margin: 1px 0 4px; font-size: 9pt; color: #64748b; }
.entry p { margin: 0; }
.entry ul { margin: 3px 0 0; padding-left: 17px; color: #475569; }
ul { margin: 3px 0 0; padding-left: 18px; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline-block; margin: 0 12px 4px 0; }
.inline-list li::before { content: "\\2022"; color: #065f46; margin-right: 6px; font-weight: 700; }
.level { color: #64748b; }
`;

export function renderExecutiveSenior(data: CvData): string {
  const headerRow = `<div class="header-row">${renderHeader(data)}${renderPhoto(data.personal.photoUrl)}</div>`;
  const body = `<main>${headerRow}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body);
}
