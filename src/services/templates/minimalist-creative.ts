import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";
import { renderPhoto } from "@/services/templates/photo.js";

const css = `
body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #404040; font-size: 10pt; line-height: 1.7; margin: 0; box-sizing: border-box; min-height: 100vh; padding: 56px 64px; }
.header-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 1px solid #e5e5e5; padding-bottom: 18px; margin-bottom: 24px; }
.header-row .header { flex: 1; }
.photo { width: 84px; height: 84px; border-radius: 50%; object-fit: cover; flex-shrink: 0; filter: grayscale(1); }
.header { margin: 0; }
.header h1 { font-size: 26pt; font-weight: 300; letter-spacing: 2px; text-transform: uppercase; margin: 0 0 8px; color: #171717; line-height: 1.05; }
.header .role { margin: 0 0 10px; font-size: 11pt; letter-spacing: 2px; text-transform: uppercase; color: #737373; }
.header .contact { margin: 0; font-size: 9pt; color: #737373; }
.section { margin-bottom: 22px; }
.section h2 { font-size: 9pt; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #525252; margin: 0 0 11px; }
.section h2::before { content: ""; display: inline-block; width: 24px; height: 1px; background: #171717; vertical-align: middle; margin-right: 12px; }
.entry { margin-bottom: 13px; }
.entry h3 { font-size: 10.5pt; font-weight: 600; margin: 0; color: #171717; }
.entry .meta { margin: 1px 0 4px; font-size: 9pt; color: #8c8c8c; }
.entry p { margin: 0; color: #404040; }
ul { margin: 3px 0 0; padding-left: 16px; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline-block; margin: 0 14px 4px 0; }
.level { color: #8c8c8c; }
`;

export function renderMinimalistCreative(data: CvData): string {
  const headerRow = `<div class="header-row">${renderHeader(data)}${renderPhoto(data.personal.photoUrl)}</div>`;
  const body = `<main>${headerRow}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body);
}
