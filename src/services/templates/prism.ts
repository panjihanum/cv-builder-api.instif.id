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
import { photoToDataUrl } from "@/services/templates/photo.js";
import { getCvLabels } from "@/services/templates/i18n.js";
import { renderSkillGroups } from "@/services/templates/skills.js";

const CHIP_BG = ["#ffe4e6", "#ede9fe", "#dbeafe"];
const CHIP_TEXT = ["#be123c", "#6d28d9", "#1d4ed8"];

const css = `
* { box-sizing: border-box; }
body { font-family: Helvetica, Arial, sans-serif; color: #262626; font-size: 9pt; line-height: 1.55; margin: 0; background: #fff; }
.banner { background: linear-gradient(130deg, #f43f5e 0%, #a855f7 50%, #3b82f6 100%); padding: 22px 38px; display: flex; align-items: center; gap: 20px; }
.banner .photo { width: 82px; height: 82px; border-radius: 50%; object-fit: cover; border: 4px solid rgba(255,255,255,0.4); flex-shrink: 0; }
.banner .info { flex: 1; color: #fff; }
.banner h1 { font-size: 20pt; font-weight: 800; letter-spacing: -0.4px; margin: 0 0 3px; }
.banner .role { font-size: 9pt; font-weight: 300; letter-spacing: 0.5px; color: rgba(255,255,255,0.75); margin: 0 0 9px; }
.banner .contact { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 7.5pt; color: rgba(255,255,255,0.7); }
.banner .contact span { display: flex; align-items: center; gap: 4px; }
.body { display: grid; grid-template-columns: 220px 1fr; min-height: 100vh; }
.sidebar { background: #f8f9fa; padding: 18px 16px; }
.s-h { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: rgba(255,255,255,0.6); margin: 14px 0 6px; }
.s-h-dark { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #6b7280; margin: 14px 0 6px; }
.s-h-dark:first-child { margin-top: 0; }
.chip-wrap { display: flex; flex-wrap: wrap; gap: 5px; }
.chip { font-size: 7.5pt; font-weight: 600; padding: 2px 8px; border-radius: 4px; }
.lang-item { font-size: 8pt; color: #374151; margin-bottom: 5px; }
.lang-item strong { color: #111; }
.cert-item { font-size: 8pt; color: #374151; margin-bottom: 6px; }
.cert-item strong { color: #111; display: block; }
.main { padding: 18px 20px; }
.sec-h { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #e11d48; margin: 14px 0 7px; }
.sec-h:first-child { margin-top: 0; }
.entry { margin-bottom: 11px; }
.entry .top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.entry h3 { margin: 0; font-size: 9.5pt; font-weight: 700; color: #0a0a0a; }
.entry .meta { margin: 1px 0 2px; font-size: 8pt; color: #6b7280; }
.entry ul { margin: 3px 0 0; padding-left: 16px; color: #404040; }
.entry p { margin: 0; color: #404040; }
ul { list-style: disc; }
p { margin: 0; }
`;

function entry(
  date: string,
  dateColor: string,
  heading: string,
  meta: string,
  body: string
): string {
  const dateLine = date
    ? `<span style="font-size:7.5pt;font-weight:600;color:${dateColor};white-space:nowrap;flex-shrink:0">${date}</span>`
    : "";
  const metaLine = meta ? `<p class="meta">${meta}</p>` : "";
  return `<div class="entry"><div class="top"><h3>${heading}</h3>${dateLine}</div>${metaLine}${body}</div>`;
}

export function renderPrism(data: CvData): string {
  const t = getCvLabels(data.language);
  const photoSrc = photoToDataUrl(data.personal.photoUrl);
  const photo = photoSrc
    ? `<img class="photo" src="${escapeHtml(photoSrc)}" alt="" />`
    : "";

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

  const banner = `<div class="banner">${photo}<div class="info"><h1>${escapeHtml(
    data.personal.fullName
  )}</h1>${role}<div class="contact">${contactParts}</div></div></div>`;

  let chipIndex = 0;
  const skills = data.skills.filter((s) => s.name.trim()).length
    ? `<p class="s-h-dark">${escapeHtml(t.skills)}</p>${renderSkillGroups(
        data.skills,
        (skill) => {
          if (!skill.name.trim()) return "";
          const bg = CHIP_BG[chipIndex % 3];
          const text = CHIP_TEXT[chipIndex % 3];
          chipIndex += 1;
          return `<span class="chip" style="background:${bg};color:${text}">${escapeHtml(skill.name)}</span>`;
        },
        { groupTag: "div", groupClass: "chip-wrap" }
      )}`
    : "";

  const languages = data.languages.filter((l) => l.name.trim()).length
    ? `<p class="s-h-dark">${escapeHtml(t.languages)}</p>${data.languages
        .filter((l) => l.name.trim())
        .map(
          (l) =>
            `<div class="lang-item"><strong>${escapeHtml(l.name)}</strong>${
              l.proficiency ? ` · ${escapeHtml(l.proficiency)}` : ""
            }</div>`
        )
        .join("")}`
    : "";

  const certs = data.certifications.filter((c) => c.name.trim()).length
    ? `<p class="s-h-dark">${escapeHtml(t.certifications)}</p>${data.certifications
        .filter((c) => c.name.trim())
        .map(
          (c) =>
            `<div class="cert-item"><strong>${escapeHtml(c.name)}</strong>${
              c.issuer ? escapeHtml(c.issuer) : ""
            }</div>`
        )
        .join("")}`
    : "";

  const sidebar = `<div class="sidebar">${skills}${languages}${certs}</div>`;

  const summary = data.summary.trim()
    ? `<p class="sec-h">${escapeHtml(t.summary)}</p>${renderSummary(data.summary)}`
    : "";

  const experience = data.experience.length
    ? `<p class="sec-h">${escapeHtml(t.experience)}</p>${data.experience
        .map((item) =>
          entry(
            escapeHtml(
              formatDateRange(
                item.startDate,
                item.endDate,
                item.current,
                data.language
              )
            ),
            "#e11d48",
            escapeHtml(item.position),
            joinNonEmpty([item.company, item.location].map(escapeHtml), " · "),
            renderDescription(item.description)
          )
        )
        .join("")}`
    : "";

  const education = data.education.length
    ? `<p class="sec-h">${escapeHtml(t.education)}</p>${data.education
        .map((item) =>
          entry(
            escapeHtml(
              formatDateRange(
                item.startDate,
                item.endDate,
                false,
                data.language
              )
            ),
            "#a855f7",
            escapeHtml(item.institution),
            joinNonEmpty(
              [
                [item.degree, item.field]
                  .filter(Boolean)
                  .map(escapeHtml)
                  .join(" "),
                item.gpa.trim() ? `${t.gpa} ${escapeHtml(item.gpa)}` : "",
              ],
              " · "
            ),
            renderDescription(item.description)
          )
        )
        .join("")}`
    : "";

  const projects = data.projects.length
    ? `<p class="sec-h">${escapeHtml(t.projects)}</p>${data.projects
        .map((p) =>
          entry(
            "",
            "",
            joinNonEmpty([p.name, p.url].map(escapeHtml), " &mdash; "),
            "",
            renderDescription(p.description)
          )
        )
        .join("")}`
    : "";

  const custom = data.customSections
    .map((cs) => {
      const items = cs.items
        .map((item) =>
          entry(
            "",
            "",
            escapeHtml(item.heading),
            "",
            renderDescription(item.body)
          )
        )
        .join("");
      return items
        ? `<p class="sec-h">${escapeHtml(cs.title || t.other)}</p>${items}`
        : "";
    })
    .join("");

  const mainContent = `<div class="main">${summary}${experience}${education}${projects}${custom}</div>`;
  const body = `${banner}<div class="body">${sidebar}${mainContent}</div>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
