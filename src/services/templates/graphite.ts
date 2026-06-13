import type { CvData } from "@/lib/cvData.js";
import {
  documentShell,
  escapeHtml,
  formatDateRange,
  joinNonEmpty,
  renderBullets,
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
body { font-family: Helvetica, Arial, sans-serif; color: #1e293b; font-size: 9.5pt; line-height: 1.5; margin: 0; }
.layout { display: grid; grid-template-columns: 30% 70%; min-height: 100vh; }
.sidebar { background: linear-gradient(180deg,#334155,#1e293b); color: #e2e8f0; padding: 22px 16px; }
.sidebar .photo { width: 104px; height: 104px; border-radius: 50%; object-fit: cover; display: block; margin: 0 auto 8px; border: 4px solid rgba(255,255,255,0.18); }
.s-h { display: flex; align-items: center; gap: 6px; margin: 16px 0 8px; padding-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.15); font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; color: #cbd5e1; }
.s-list { list-style: none; margin: 0; padding: 0; font-size: 8.5pt; color: #cbd5e1; }
.s-list li { margin-bottom: 5px; display: flex; align-items: center; gap: 6px; }
.s-list li.lang { justify-content: space-between; }
.s-list li span.txt { word-break: break-word; }
.s-list .pro { color: #94a3b8; }
.bar-row { margin-bottom: 8px; }
.bar-row .lbl { font-size: 8.5pt; margin-bottom: 3px; }
.bar { height: 4px; width: 100%; background: rgba(255,255,255,0.15); border-radius: 999px; }
.bar > span { display: block; height: 4px; border-radius: 999px; background: #e2e8f0; }
.main { padding: 24px 24px; }
.namehead { border-bottom: 2px solid #1e293b; padding-bottom: 12px; margin-bottom: 16px; }
.namehead h1 { margin: 0; font-size: 23pt; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px; color: #0f172a; }
.namehead .role { margin: 6px 0 0; font-size: 9.5pt; font-weight: 500; text-transform: uppercase; letter-spacing: 5px; color: #64748b; }
.sec { margin-bottom: 15px; }
.sec-h { display: flex; align-items: center; gap: 8px; margin: 0 0 9px; font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #334155; }
.sec-h .ic { display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 4px; background: #334155; color: #ffffff; }
.sec-h .rule { height: 1px; flex: 1; background: #e2e8f0; }
.entry { border-left: 3px solid #cbd5e1; padding-left: 14px; margin-bottom: 11px; }
.entry .top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.entry h3 { margin: 0; font-size: 10pt; color: #0f172a; }
.entry .date { font-size: 8pt; font-weight: 500; color: #64748b; white-space: nowrap; }
.entry .meta { margin: 1px 0 2px; font-size: 8.5pt; font-weight: 500; color: #475569; }
.entry ul { margin: 3px 0 0; padding-left: 16px; color: #475569; }
.skill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 22px; }
.skill-grid .si { display: flex; align-items: center; gap: 7px; color: #334155; font-size: 9pt; }
.skill-grid .si .pt { width: 6px; height: 6px; border-radius: 50%; background: #334155; flex-shrink: 0; }
.blk { margin-bottom: 8px; }
.blk h3 { margin: 0; font-size: 9.5pt; color: #0f172a; }
.blk ul { margin: 3px 0 0; padding-left: 16px; color: #475569; }
p { margin: 0; }
`;

function clampLevel(level: number): number {
  return Math.min(Math.max(level, 1), 5);
}

function sideHeader(icon: SectionIconKey, title: string): string {
  return `<div class="s-h">${sectionIconSvg(icon, 11)}${escapeHtml(title)}</div>`;
}

function mainHeader(icon: SectionIconKey, title: string): string {
  return `<div class="sec-h"><span class="ic">${sectionIconSvg(
    icon,
    12
  )}</span>${escapeHtml(title)}<span class="rule"></span></div>`;
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
        `<li class="lang"><span class="txt">${escapeHtml(
          language.name
        )}</span><span class="pro">${escapeHtml(language.proficiency)}</span></li>`
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

  return `<aside class="sidebar">${photo}${contact}${skillsBlock}${langBlock}${certBlock}</aside>`;
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
      }${renderBullets(item.description)}</div>`;
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

function renderSkillsGrid(data: CvData): string {
  const items = data.skills
    .filter((skill) => skill.name.trim().length > 0)
    .map(
      (skill) =>
        `<div class="si"><span class="pt"></span>${escapeHtml(skill.name)}</div>`
    )
    .join("");
  return mainSection(
    "strengths",
    "Keahlian",
    items ? `<div class="skill-grid">${items}</div>` : ""
  );
}

function renderProjects(data: CvData): string {
  const entries = data.projects
    .map(
      (project) =>
        `<div class="blk"><h3>${joinNonEmpty(
          [project.name, project.url].map(escapeHtml),
          " · "
        )}</h3>${renderBullets(project.description)}</div>`
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
          return `<div class="blk">${heading}${renderBullets(item.body)}</div>`;
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

function renderHead(data: CvData): string {
  const role = data.personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(data.personal.jobTitle)}</p>`
    : "";
  return `<div class="namehead"><h1>${escapeHtml(
    data.personal.fullName
  )}</h1>${role}</div>`;
}

export function renderGraphite(data: CvData): string {
  const summary = data.summary.trim()
    ? mainSection(
        "summary",
        "Tentang Saya",
        `<p>${escapeHtml(data.summary)}</p>`
      )
    : "";
  const main = [
    '<div class="main">',
    renderHead(data),
    summary,
    renderExperience(data),
    renderEducation(data),
    renderSkillsGrid(data),
    renderProjects(data),
    renderCustom(data),
    "</div>",
  ].join("");
  const body = `<div class="layout">${renderSidebar(data)}${main}</div>`;
  return documentShell(data.personal.fullName, css, body);
}
