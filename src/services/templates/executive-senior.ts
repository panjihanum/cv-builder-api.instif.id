import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";
import { renderPhoto } from "@/services/templates/photo.js";

const css = `
body { font-family: Georgia, "Times New Roman", serif; color: #1c2434; font-size: 10.5pt; line-height: 1.55; margin: 0; }
.header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 3px double #1c2434; margin-bottom: 16px; }
.header-row .header { flex: 1; }
.photo { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; flex-shrink: 0; margin-bottom: 12px; }
.header { border-bottom: 3px double #1c2434; padding-bottom: 12px; margin-bottom: 16px; }
.header-row .header { border-bottom: none; margin-bottom: 0; }
.header h1 { font-size: 21pt; margin: 0 0 2px; letter-spacing: 0.5px; }
.header .role { margin: 0 0 5px; font-size: 12pt; font-style: italic; color: #344054; }
.header .contact { margin: 0; font-size: 9.5pt; color: #475467; }
.section { margin-bottom: 14px; }
.section h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 1.2px; color: #1c2434; margin: 0 0 8px; }
.entry { margin-bottom: 10px; padding-left: 12px; border-left: 2px solid #1c2434; }
.entry h3 { font-size: 11pt; margin: 0; font-weight: 700; }
.entry .meta { margin: 1px 0 4px; font-size: 9.5pt; color: #475467; font-style: italic; }
.entry p { margin: 0; }
ul { margin: 0; padding-left: 18px; }
.inline-list { list-style: none; padding: 0; }
.inline-list li { display: inline-block; margin: 0 12px 3px 0; }
.level { color: #475467; }
`;

export function renderExecutiveSenior(data: CvData): string {
  const headerRow = `<div class="header-row">${renderHeader(data)}${renderPhoto(data.personal.photoUrl)}</div>`;
  const body = `<main>${headerRow}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body);
}
