import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";

const css = `
body { font-family: Helvetica, Arial, sans-serif; color: #334155; font-size: 10pt; line-height: 1.5; margin: 0; box-sizing: border-box; min-height: 100vh; padding: 44px 48px; }
.header { padding-bottom: 10px; margin-bottom: 14px; }
.header h1 { font-size: 22pt; margin: 0 0 2px; color: #0f172a; font-weight: 800; letter-spacing: -0.3px; }
.header .role { margin: 0 0 6px; font-size: 10.5pt; color: #047857; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; }
.header .contact { margin: 0; font-size: 8.5pt; color: #64748b; }
.section { margin-bottom: 13px; }
.section h2 { font-size: 9.5pt; text-transform: uppercase; letter-spacing: 2px; color: #047857; border-bottom: 1.5pt solid #059669; padding-bottom: 3px; margin: 0 0 7px; font-weight: 700; }
.entry { margin-bottom: 9px; }
.entry h3 { font-size: 10.5pt; margin: 0; color: #0f172a; font-weight: 700; }
.entry .meta { margin: 1px 0 3px; font-size: 9pt; color: #047857; font-weight: 500; }
.entry p { margin: 0; }
ul { margin: 3px 0 0; padding-left: 17px; color: #475569; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline-block; margin: 0 5px 5px 0; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; border-radius: 4px; padding: 2px 8px; font-size: 8.5pt; font-weight: 600; }
.level { display: none; }
`;

export function renderAtsProfessional(data: CvData): string {
  const body = `<main>${renderHeader(data)}${renderBodySections(data)}</main>`;
  return documentShell(data.personal.fullName, css, body);
}
