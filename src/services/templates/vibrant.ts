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
import {
  sectionIconSvg,
  resolveSectionIcon,
  type SectionIconKey,
} from "@/services/templates/sectionIcons.js";
import { photoToDataUrl } from "@/services/templates/photo.js";

const css = `
* { box-sizing: border-box; }
/* Sidebar colour on the page background so the left column keeps its fill on
   page 2+ (Chrome doesn't repeat a grid item's background across a page break). */
body { font-family: Helvetica, Arial, sans-serif; color: #1e293b; font-size: 9.5pt; line-height: 1.5; margin: 0; background: linear-gradient(90deg, #0d9488 0, #0d9488 33%, #ffffff 33%, #ffffff 100%); }
.layout { display: grid; grid-template-columns: 33% 67%; min-height: 100vh; }
.sidebar { background: linear-gradient(165deg,#10b981 0%,#0d9488 50%,#0891b2 100%); color: #ffffff; padding: 24px 18px; }
.sidebar .photo { width: 94px; height: 94px; border-radius: 50%; object-fit: cover; display: block; margin: 0 auto 14px; border: 3px solid rgba(255,255,255,0.4); }
.sidebar h1 { margin: 0; font-size: 17pt; font-weight: 800; line-height: 1.15; }
.sidebar .role { margin: 3px 0 0; font-size: 9.5pt; font-weight: 500; color: #d1fae5; }
.s-h { display: flex; align-items: center; gap: 6px; margin: 16px 0 8px; padding-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.18); font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #ecfdf5; }
.s-list { list-style: none; margin: 0; padding: 0; font-size: 8.5pt; }
.s-list li { margin-bottom: 5px; display: flex; align-items: center; gap: 5px; }
.s-list li span.txt { word-break: break-word; }
.bar-row { margin-bottom: 7px; }
.bar-row .lbl { font-size: 8.5pt; margin-bottom: 3px; }
.bar { height: 5px; width: 100%; background: rgba(255,255,255,0.28); border-radius: 999px; }
.bar > span { display: block; height: 5px; border-radius: 999px; background: #ffffff; }
.main { padding: 24px 24px; }
.sec { margin-bottom: 15px; }
.sec-h { display: flex; align-items: center; gap: 8px; margin: 0 0 9px; font-size: 11pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #047857; }
.sec-h .ic { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 6px; background: linear-gradient(135deg,#10b981,#0d9488); color: #ffffff; }
.entry { margin-bottom: 10px; }
.entry .top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.entry h3 { margin: 0; font-size: 10pt; color: #0f172a; }
.entry .date { font-size: 8pt; font-weight: 600; color: #047857; white-space: nowrap; }
.entry .meta { margin: 1px 0 2px; font-size: 8.5pt; color: #64748b; }
.entry ul { margin: 3px 0 0; padding-left: 16px; color: #475569; }
.muted { color: #64748b; }
p { margin: 0; }
`;

function clampLevel(level: number): number {
  return Math.min(Math.max(level, 1), 5);
}

function sideHeader(icon: SectionIconKey, title: string): string {
  return `<div class="s-h">${sectionIconSvg(icon, 12)}${escapeHtml(title)}</div>`;
}

function mainHeader(icon: SectionIconKey, title: string): string {
  return `<div class="sec-h"><span class="ic">${sectionIconSvg(
    icon,
    13
  )}</span>${escapeHtml(title)}</div>`;
}

function mainSection(
  icon: SectionIconKey,
  title: string,
  content: string
): string {
  if (!content) return "";
  return `<section class="sec">${mainHeader(icon, title)}${content}</section>`;
}

function renderSidebar(data: CvData): string {
  const photoSrc = photoToDataUrl(data.personal.photoUrl);
  const photo = photoSrc
    ? `<img class="photo" src="${escapeHtml(photoSrc)}" alt="" />`
    : "";
  const role = data.personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(data.personal.jobTitle)}</p>`
    : "";

  const contactRows = [
    data.personal.email
      ? `<li>${linkIconSvg("mail", 12)}<span class="txt">${escapeHtml(data.personal.email)}</span></li>`
      : "",
    data.personal.phone
      ? `<li>${linkIconSvg("phone", 12)}<span class="txt">${escapeHtml(data.personal.phone)}</span></li>`
      : "",
    data.personal.address
      ? `<li>${linkIconSvg("location", 12)}<span class="txt">${escapeHtml(data.personal.address)}</span></li>`
      : "",
    ...data.personal.links.map((link) => {
      const text = formatLinkText(link);
      return text.trim()
        ? `<li>${linkIconSvg(resolveLinkIcon(link), 12)}<span class="txt">${escapeHtml(text)}</span></li>`
        : "";
    }),
  ].join("");
  const contact = contactRows
    ? `${sideHeader("summary", "Kontak")}<ul class="s-list">${contactRows}</ul>`
    : "";

  const skills = data.skills
    .filter((skill) => skill.name.trim().length > 0)
    .map(
      (skill) =>
        `<div class="bar-row"><div class="lbl">${escapeHtml(
          skill.name
        )}</div><div class="bar"><span style="width:${
          (clampLevel(skill.level) / 5) * 100
        }%"></span></div></div>`
    )
    .join("");
  const skillsBlock = skills
    ? `${sideHeader("skills", "Keahlian")}${skills}`
    : "";

  const languages = data.languages
    .filter((language) => language.name.trim().length > 0)
    .map(
      (language) =>
        `<li><span class="txt">${escapeHtml(language.name)}${
          language.proficiency ? ` (${escapeHtml(language.proficiency)})` : ""
        }</span></li>`
    )
    .join("");
  const langBlock = languages
    ? `${sideHeader("languages", "Bahasa")}<ul class="s-list">${languages}</ul>`
    : "";

  const certs = data.certifications
    .map((certification) =>
      joinNonEmpty(
        [certification.name, certification.issuer].map(escapeHtml),
        " — "
      )
    )
    .filter((item) => item.length > 0)
    .map((item) => `<li><span class="txt">${item}</span></li>`)
    .join("");
  const certBlock = certs
    ? `${sideHeader("certifications", "Sertifikasi")}<ul class="s-list">${certs}</ul>`
    : "";

  return `<aside class="sidebar">${photo}<h1>${escapeHtml(
    data.personal.fullName
  )}</h1>${role}${contact}${skillsBlock}${langBlock}${certBlock}</aside>`;
}

function renderExperience(data: CvData): string {
  const entries = data.experience
    .map((item) => {
      const date = escapeHtml(
        formatDateRange(item.startDate, item.endDate, item.current)
      );
      const meta = joinNonEmpty(
        [item.company, item.location].map(escapeHtml),
        " · "
      );
      return `<div class="entry"><div class="top"><h3>${escapeHtml(
        item.position
      )}</h3><span class="date">${date}</span></div>${
        meta ? `<p class="meta">${meta}</p>` : ""
      }${renderDescription(item.description)}</div>`;
    })
    .join("");
  return mainSection("experience", "Pengalaman Kerja", entries);
}

function renderEducation(data: CvData): string {
  const entries = data.education
    .map((item) => {
      const date = escapeHtml(
        formatDateRange(item.startDate, item.endDate, false)
      );
      const meta = joinNonEmpty(
        [
          [item.degree, item.field].filter(Boolean).map(escapeHtml).join(" "),
          item.gpa.trim() ? `IPK ${escapeHtml(item.gpa)}` : "",
        ],
        " · "
      );
      return `<div class="entry"><div class="top"><h3>${escapeHtml(
        item.institution
      )}</h3><span class="date">${date}</span></div>${
        meta ? `<p class="meta">${meta}</p>` : ""
      }</div>`;
    })
    .join("");
  return mainSection("education", "Pendidikan", entries);
}

function renderProjects(data: CvData): string {
  const entries = data.projects
    .map(
      (project) =>
        `<div class="entry"><h3>${joinNonEmpty(
          [project.name, project.url].map(escapeHtml),
          " · "
        )}</h3>${renderDescription(project.description)}</div>`
    )
    .join("");
  return mainSection("projects", "Proyek", entries);
}

function renderCustom(data: CvData): string {
  return data.customSections
    .map((custom) => {
      const items = custom.items
        .map((item) => {
          const heading = item.heading.trim()
            ? `<h3>${escapeHtml(item.heading)}</h3>`
            : "";
          return `<div class="entry">${heading}${renderDescription(item.body)}</div>`;
        })
        .join("");
      return mainSection(
        resolveSectionIcon(custom.icon, "custom"),
        custom.title || "Lainnya",
        items
      );
    })
    .join("");
}

export function renderVibrant(data: CvData): string {
  const summary = data.summary.trim()
    ? mainSection("summary", "Ringkasan", renderSummary(data.summary, "muted"))
    : "";
  const main = [
    '<div class="main">',
    summary,
    renderExperience(data),
    renderEducation(data),
    renderProjects(data),
    renderCustom(data),
    "</div>",
  ].join("");
  const body = `<div class="layout">${renderSidebar(data)}${main}</div>`;
  return documentShell(data.personal.fullName, css, body);
}
