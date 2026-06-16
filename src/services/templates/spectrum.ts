import type { CvData } from "@/lib/cvData.js";
import {
  documentShell,
  escapeHtml,
  formatDateRange,
  joinNonEmpty,
  renderDescription,
  renderSummary,
} from "@/services/templates/shared.js";
import {
  formatLinkText,
  linkIconSvg,
  resolveLinkIcon,
} from "@/services/templates/linkIcons.js";

const ACCENT_BG = ["#ffe4e6", "#ede9fe", "#dbeafe", "#ccfbf1", "#fef3c7"];
const ACCENT_TEXT = ["#be123c", "#6d28d9", "#1d4ed8", "#0f766e", "#92400e"];
const ACCENT_BORDER = ["#fda4af", "#c4b5fd", "#93c5fd", "#5eead4", "#fcd34d"];

const css = `
* { box-sizing: border-box; }
body { font-family: Helvetica, Arial, sans-serif; color: #262626; font-size: 9.5pt; line-height: 1.55; margin: 0; background: #ffffff; min-height: 100vh; }
.page { padding: 36px 46px; }
h1 { font-size: 22pt; font-weight: 800; letter-spacing: -0.5px; color: #0a0a0a; margin: 0 0 2px; }
.role { margin: 0; font-size: 9pt; font-weight: 700; background: linear-gradient(90deg, #f43f5e, #8b5cf6, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.contact { display: flex; flex-wrap: wrap; gap: 5px 14px; font-size: 7.5pt; color: #6b7280; margin: 8px 0 0; }
.contact span { display: flex; align-items: center; gap: 4px; }
.gradient-line { height: 2px; background: linear-gradient(90deg, #f43f5e, #8b5cf6, #3b82f6); margin: 12px 0; }
.sec-h { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2.5px; color: #374151; margin: 18px 0 8px; }
.chip-wrap { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-size: 7.5pt; font-weight: 600; padding: 3px 9px; border-radius: 999px; }
.entry { border-left: 2px solid #e5e7eb; padding-left: 12px; margin-bottom: 12px; }
.entry .top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.entry h3 { margin: 0; font-size: 9.5pt; font-weight: 700; color: #0a0a0a; }
.entry .meta { margin: 1px 0 2px; font-size: 8pt; color: #6b7280; }
.entry ul { margin: 3px 0 0; padding-left: 16px; color: #404040; }
.entry p { margin: 0; color: #404040; }
.blk { margin-bottom: 8px; }
.blk h3 { margin: 0; font-size: 9pt; font-weight: 600; color: #0a0a0a; }
ul { list-style: disc; }
p { margin: 0; }
`;

function section(title: string, content: string): string {
  if (!content) return "";
  return `<div><p class="sec-h">${escapeHtml(title)}</p>${content}</div>`;
}

export function renderSpectrum(data: CvData): string {
  const contactParts = [
    data.personal.email
      ? `<span>${linkIconSvg("mail", 11)}${escapeHtml(data.personal.email)}</span>`
      : "",
    data.personal.phone
      ? `<span>${linkIconSvg("phone", 11)}${escapeHtml(data.personal.phone)}</span>`
      : "",
    data.personal.address
      ? `<span>${linkIconSvg("location", 11)}${escapeHtml(data.personal.address)}</span>`
      : "",
    ...data.personal.links.map((link) => {
      const txt = formatLinkText(link);
      return txt
        ? `<span>${linkIconSvg(resolveLinkIcon(link), 11)}${escapeHtml(txt)}</span>`
        : "";
    }),
  ]
    .filter(Boolean)
    .join("");

  const role = data.personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(data.personal.jobTitle)}</p>`
    : "";

  const headerHtml = `<div>
    <h1>${escapeHtml(data.personal.fullName)}</h1>
    ${role}
    <div class="contact">${contactParts}</div>
    <div class="gradient-line"></div>
  </div>`;

  const summary = data.summary.trim()
    ? section("Tentang Saya", renderSummary(data.summary))
    : "";

  const skills = data.skills.filter((s) => s.name.trim()).length
    ? section(
        "Keahlian",
        `<div class="chip-wrap">${data.skills
          .filter((s) => s.name.trim())
          .map((s, i) => {
            const bg = ACCENT_BG[i % ACCENT_BG.length];
            const text = ACCENT_TEXT[i % ACCENT_TEXT.length];
            return `<span class="chip" style="background:${bg};color:${text}">${escapeHtml(
              s.name
            )}</span>`;
          })
          .join("")}</div>`
      )
    : "";

  const experience = data.experience.length
    ? section(
        "Pengalaman Kerja",
        data.experience
          .map((item, i) => {
            const border = ACCENT_BORDER[i % ACCENT_BORDER.length];
            const dateColor = ACCENT_TEXT[i % ACCENT_TEXT.length];
            const date = escapeHtml(
              formatDateRange(item.startDate, item.endDate, item.current)
            );
            const meta = joinNonEmpty(
              [item.company, item.location].map(escapeHtml),
              " · "
            );
            return `<div class="entry" style="border-left-color:${border}"><div class="top"><h3>${escapeHtml(
              item.position
            )}</h3><span style="font-size:7.5pt;font-weight:600;color:${dateColor};white-space:nowrap;flex-shrink:0">${date}</span></div>${
              meta ? `<p class="meta">${meta}</p>` : ""
            }${renderDescription(item.description)}</div>`;
          })
          .join("")
      )
    : "";

  const education = data.education.length
    ? section(
        "Pendidikan",
        data.education
          .map((item) => {
            const date = escapeHtml(
              formatDateRange(item.startDate, item.endDate, false)
            );
            const meta = joinNonEmpty(
              [
                [item.degree, item.field]
                  .filter(Boolean)
                  .map(escapeHtml)
                  .join(" "),
                item.gpa.trim() ? `IPK ${escapeHtml(item.gpa)}` : "",
              ],
              " · "
            );
            return `<div class="entry"><div class="top"><h3>${escapeHtml(
              item.institution
            )}</h3><span style="font-size:7.5pt;color:#8b5cf6;white-space:nowrap;flex-shrink:0">${date}</span></div>${
              meta ? `<p class="meta">${meta}</p>` : ""
            }</div>`;
          })
          .join("")
      )
    : "";

  const projects = data.projects.length
    ? section(
        "Proyek",
        data.projects
          .map((p) => {
            const heading = joinNonEmpty(
              [p.name, p.url].map(escapeHtml),
              " &mdash; "
            );
            return `<div class="entry"><div class="top"><h3>${heading}</h3></div>${renderDescription(
              p.description
            )}</div>`;
          })
          .join("")
      )
    : "";

  const certifications = data.certifications.length
    ? section(
        "Sertifikasi",
        `<div class="chip-wrap">${data.certifications
          .map((c, i) => {
            const bg = ACCENT_BG[i % ACCENT_BG.length];
            const text = ACCENT_TEXT[i % ACCENT_TEXT.length];
            const label = joinNonEmpty(
              [c.name, c.issuer].map(escapeHtml),
              " &middot; "
            );
            return `<span class="chip" style="background:${bg};color:${text}">${label}</span>`;
          })
          .join("")}</div>`
      )
    : "";

  const languages = data.languages.filter((l) => l.name.trim()).length
    ? section(
        "Bahasa",
        `<div class="chip-wrap">${data.languages
          .filter((l) => l.name.trim())
          .map((l, i) => {
            const bg = ACCENT_BG[i % ACCENT_BG.length];
            const text = ACCENT_TEXT[i % ACCENT_TEXT.length];
            const label = l.proficiency
              ? `${escapeHtml(l.name)} &middot; ${escapeHtml(l.proficiency)}`
              : escapeHtml(l.name);
            return `<span class="chip" style="background:${bg};color:${text}">${label}</span>`;
          })
          .join("")}</div>`
      )
    : "";

  const custom = data.customSections
    .map((cs) =>
      section(
        cs.title || "Lainnya",
        cs.items
          .map((item) => {
            const h = item.heading
              ? `<div class="blk"><h3>${escapeHtml(item.heading)}</h3></div>`
              : "";
            return `${h}${renderDescription(item.body)}`;
          })
          .join("")
      )
    )
    .join("");

  const body = `<div class="page">${headerHtml}${summary}${skills}${experience}${education}${projects}${certifications}${languages}${custom}</div>`;
  return documentShell(data.personal.fullName, css, body);
}
