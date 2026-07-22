import type { CvData } from "@/lib/cvData.js";
import { documentShell } from "@/services/templates/shared.js";
import {
  renderBodySections,
  renderHeader,
} from "@/services/templates/sections.js";

const css = `
body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; font-size: 10.5pt; line-height: 1.55; margin: 0; box-sizing: border-box; min-height: 100vh; padding: 48px 56px; }
.header { text-align: center; border-bottom: 1.5pt solid #1a1a1a; padding-bottom: 12px; margin-bottom: 16px; }
.header h1 { font-size: 21pt; margin: 0 0 5px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; }
.header .role { margin: 0 0 6px; font-size: 10.5pt; text-transform: uppercase; letter-spacing: 3px; color: #555; }
.header .contact { margin: 0; font-size: 9pt; color: #333; }
.section { margin-bottom: 13px; }
.section h2 { font-size: 11pt; text-transform: uppercase; letter-spacing: 2.5px; border-bottom: 0.75pt solid #999; padding-bottom: 3px; margin: 0 0 7px; font-weight: 700; }
.entry { margin-bottom: 9px; }
.entry h3 { font-size: 10.5pt; margin: 0; font-weight: 700; }
.entry .meta { margin: 1px 0 3px; font-size: 9.5pt; color: #444; font-style: italic; }
.entry p { margin: 0; }
ul { margin: 3px 0 0; padding-left: 18px; }
.inline-list { list-style: none; padding: 0; margin: 0; }
.inline-list li { display: inline; }
.inline-list li:not(:last-child)::after { content: " \\00b7 "; }
`;

export function renderClassicAts(data: CvData): string {
  const body = `<main>${renderHeader(data)}${renderBodySections(data, { skillsSeparator: ", " })}</main>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
