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

const css = `
* { box-sizing: border-box; }
body { font-family: Georgia, "Times New Roman", serif; color: #292524; font-size: 10pt; line-height: 1.55; margin: 0; min-height: 100vh; background: #fcfaf6; border-top: 5px solid #b45309; }
.page { padding: 40px 48px; }
.head { text-align: center; border-bottom: 2px solid #292524; padding-bottom: 16px; }
.head h1 { margin: 0; font-size: 28pt; font-weight: 700; letter-spacing: -0.5px; color: #1c1917; }
.head .role { margin: 7px 0 0; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 4px; color: #b45309; }
.contact { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 16px; margin-top: 11px; font-family: Helvetica, Arial, sans-serif; font-size: 8.5pt; color: #57534e; }
.chip { display: inline-flex; align-items: center; gap: 5px; }
.sec-h { display: flex; align-items: center; gap: 9px; margin: 18px 0 9px; color: #b45309; }
.sec-h .t { font-size: 9.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 3px; white-space: nowrap; }
.sec-h .rule { height: 1px; flex: 1; background: linear-gradient(90deg,#fbbf24,rgba(251,191,36,0)); }
.entry { margin-bottom: 11px; }
.entry .top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.entry h3 { margin: 0; font-size: 11pt; color: #1c1917; }
.entry .date { font-family: Helvetica, Arial, sans-serif; font-size: 8pt; color: #78716c; white-space: nowrap; }
.entry .org { margin: 1px 0 2px; font-size: 9pt; font-style: italic; color: #92400e; }
.entry ul { margin: 3px 0 0; padding-left: 17px; color: #44403c; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; }
.tag { font-family: Helvetica, Arial, sans-serif; font-size: 8pt; color: #78350f; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 999px; padding: 2px 9px; }
.cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
.list { list-style: none; margin: 0; padding: 0; font-size: 9pt; color: #44403c; }
.list li { margin-bottom: 3px; }
p { margin: 0; }
`;

function chip(iconSvg: string, text: string): string {
  if (!text.trim()) return "";
  return `<span class="chip">${iconSvg}<span>${escapeHtml(text)}</span></span>`;
}

function sectionTitle(icon: SectionIconKey, title: string): string {
  return `<div class="sec-h">${sectionIconSvg(
    icon,
    14
  )}<span class="t">${escapeHtml(title)}</span><span class="rule"></span></div>`;
}

function renderHead(data: CvData): string {
  const role = data.personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(data.personal.jobTitle)}</p>`
    : "";
  const contacts = [
    chip(linkIconSvg("mail", 12), data.personal.email),
    chip(linkIconSvg("phone", 12), data.personal.phone),
    chip(linkIconSvg("location", 12), data.personal.address),
    ...data.personal.links.map((link) =>
      chip(linkIconSvg(resolveLinkIcon(link), 12), formatLinkText(link))
    ),
  ].join("");
  return `<header class="head"><h1>${escapeHtml(
    data.personal.fullName
  )}</h1>${role}<div class="contact">${contacts}</div></header>`;
}

function renderSummary(data: CvData): string {
  if (!data.summary.trim()) return "";
  return `<section>${sectionTitle("summary", "Profil")}<p>${escapeHtml(
    data.summary
  )}</p></section>`;
}

function renderExperience(data: CvData): string {
  if (data.experience.length === 0) return "";
  const entries = data.experience
    .map((item) => {
      const date = escapeHtml(
        formatDateRange(item.startDate, item.endDate, item.current)
      );
      const org = joinNonEmpty(
        [item.company, item.location].map(escapeHtml),
        ", "
      );
      return `<div class="entry"><div class="top"><h3>${escapeHtml(
        item.position
      )}</h3><span class="date">${date}</span></div>${
        org ? `<p class="org">${org}</p>` : ""
      }${renderBullets(item.description)}</div>`;
    })
    .join("");
  return `<section>${sectionTitle("experience", "Pengalaman")}${entries}</section>`;
}

function renderEducation(data: CvData): string {
  if (data.education.length === 0) return "";
  const entries = data.education
    .map((item) => {
      const date = escapeHtml(
        formatDateRange(item.startDate, item.endDate, false)
      );
      const meta = joinNonEmpty(
        [
          [item.degree, item.field].filter(Boolean).map(escapeHtml).join(" "),
          item.gpa.trim() ? `IPK ${escapeHtml(item.gpa)}` : "",
          escapeHtml(item.description),
        ],
        ", "
      );
      return `<div class="entry"><div class="top"><h3>${escapeHtml(
        item.institution
      )}</h3><span class="date">${date}</span></div>${
        meta ? `<p class="org">${meta}</p>` : ""
      }</div>`;
    })
    .join("");
  return `<section>${sectionTitle("education", "Pendidikan")}${entries}</section>`;
}

function renderSkills(data: CvData): string {
  const tags = data.skills
    .filter((skill) => skill.name.trim().length > 0)
    .map((skill) => `<span class="tag">${escapeHtml(skill.name)}</span>`)
    .join("");
  if (!tags) return "";
  return `<section>${sectionTitle(
    "skills",
    "Keahlian"
  )}<div class="tags">${tags}</div></section>`;
}

function renderProjects(data: CvData): string {
  if (data.projects.length === 0) return "";
  const entries = data.projects
    .map(
      (project) =>
        `<div class="entry"><h3>${joinNonEmpty(
          [project.name, project.url].map(escapeHtml),
          " — "
        )}</h3>${renderBullets(project.description)}</div>`
    )
    .join("");
  return `<section>${sectionTitle("projects", "Proyek")}${entries}</section>`;
}

function renderCertsLanguages(data: CvData): string {
  const certs = data.certifications
    .map((certification) =>
      joinNonEmpty(
        [certification.name, certification.issuer].map(escapeHtml),
        " — "
      )
    )
    .filter((item) => item.length > 0)
    .map((item) => `<li>${item}</li>`)
    .join("");
  const languages = data.languages
    .filter((language) => language.name.trim().length > 0)
    .map(
      (language) =>
        `<li>${escapeHtml(language.name)}${
          language.proficiency ? ` (${escapeHtml(language.proficiency)})` : ""
        }</li>`
    )
    .join("");
  if (!certs && !languages) return "";
  const certCol = certs
    ? `<div>${sectionTitle(
        "certifications",
        "Sertifikasi"
      )}<ul class="list">${certs}</ul></div>`
    : "";
  const langCol = languages
    ? `<div>${sectionTitle(
        "languages",
        "Bahasa"
      )}<ul class="list">${languages}</ul></div>`
    : "";
  return `<div class="cols">${certCol}${langCol}</div>`;
}

function renderCustom(data: CvData): string {
  return data.customSections
    .map((custom) => {
      const items = custom.items
        .map((item) => {
          const heading = item.heading.trim()
            ? `<h3>${escapeHtml(item.heading)}</h3>`
            : "";
          return `<div class="entry">${heading}${renderBullets(item.body)}</div>`;
        })
        .join("");
      if (!items) return "";
      return `<section>${sectionTitle(
        resolveSectionIcon(custom.icon, "custom"),
        custom.title || "Lainnya"
      )}${items}</section>`;
    })
    .join("");
}

export function renderEditorial(data: CvData): string {
  const body = [
    '<div class="page">',
    renderHead(data),
    renderSummary(data),
    renderExperience(data),
    renderEducation(data),
    renderSkills(data),
    renderProjects(data),
    renderCertsLanguages(data),
    renderCustom(data),
    "</div>",
  ].join("");
  return documentShell(data.personal.fullName, css, body);
}
