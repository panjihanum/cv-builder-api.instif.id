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
.hero { display: flex; align-items: center; gap: 18px; padding: 26px 30px; color: #ffffff; background: linear-gradient(120deg,#4338ca 0%,#7c3aed 45%,#db2777 100%); }
.hero .photo { width: 92px; height: 92px; border-radius: 50%; object-fit: cover; border: 3px solid rgba(255,255,255,0.45); }
.hero h1 { margin: 0; font-size: 22pt; font-weight: 800; letter-spacing: -0.5px; }
.hero .role { margin: 3px 0 0; font-size: 12pt; font-weight: 500; color: #fbcfe8; }
.accent { height: 5px; background: linear-gradient(90deg,#6366f1,#d946ef,#ec4899); }
.contact-row { display: flex; flex-wrap: wrap; gap: 5px 16px; margin-top: 10px; font-size: 8.5pt; }
.chip { display: inline-flex; align-items: center; gap: 5px; }
.body { display: grid; grid-template-columns: 1fr 36%; }
.main { padding: 22px 22px; }
.aside { padding: 20px 18px; background: #f8fafc; border-left: 1px solid #e2e8f0; }
.sec { margin-bottom: 16px; }
.sec:last-child { margin-bottom: 0; }
.sec-h { display: flex; align-items: center; gap: 7px; margin: 0 0 9px; }
.sec-h .ic { display: flex; align-items: center; justify-content: center; width: 19px; height: 19px; border-radius: 5px; color: #ffffff; }
.sec-h .ic.main { background: linear-gradient(135deg,#6366f1,#d946ef); }
.sec-h .ic.side { background: linear-gradient(135deg,#0f172a,#475569); }
.sec-h span.t { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.6px; color: #334155; }
.xp { border: 1px solid #eef2f7; background: #f8fafc; border-radius: 8px; padding: 10px 12px; margin-bottom: 9px; }
.xp .top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.xp h3 { margin: 0; font-size: 10pt; color: #0f172a; }
.xp .pill { font-size: 7.5pt; font-weight: 600; color: #4338ca; background: #e0e7ff; border-radius: 999px; padding: 2px 8px; white-space: nowrap; }
.xp .org { margin: 1px 0 3px; font-size: 8.5pt; font-weight: 500; color: #be185d; }
.xp ul, .blk ul { margin: 4px 0 0; padding-left: 16px; color: #475569; }
.blk { margin-bottom: 8px; }
.blk h3 { margin: 0; font-size: 9.5pt; color: #0f172a; }
.muted { color: #64748b; }
p { margin: 0; }
.bar-row { margin-bottom: 8px; }
.bar-row .lbl { font-size: 8.5pt; font-weight: 500; color: #334155; margin-bottom: 3px; }
.bar { height: 5px; width: 100%; background: #e2e8f0; border-radius: 999px; }
.bar > span { display: block; height: 5px; border-radius: 999px; background: linear-gradient(90deg,#6366f1,#d946ef); }
.side-block { margin-bottom: 14px; }
.side-block:last-child { margin-bottom: 0; }
.side-list { list-style: none; margin: 0; padding: 0; font-size: 8.5pt; color: #475569; }
.side-list li { margin-bottom: 5px; }
.side-list .name { font-weight: 600; color: #334155; }
.lang-row { display: flex; justify-content: space-between; gap: 6px; }
`;

function clampLevel(level: number): number {
  return Math.min(Math.max(level, 1), 5);
}

function chip(iconSvg: string, text: string): string {
  if (!text.trim()) return "";
  return `<span class="chip">${iconSvg}<span>${escapeHtml(text)}</span></span>`;
}

function header(data: CvData): string {
  const photoSrc = photoToDataUrl(data.personal.photoUrl);
  const photo = photoSrc
    ? `<img class="photo" src="${escapeHtml(photoSrc)}" alt="" />`
    : "";
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
  return `<header class="hero">${photo}<div><h1>${escapeHtml(
    data.personal.fullName
  )}</h1>${role}<div class="contact-row">${contacts}</div></div></header>`;
}

function secHeader(
  icon: SectionIconKey,
  title: string,
  tone: "main" | "side"
): string {
  return `<div class="sec-h"><span class="ic ${tone}">${sectionIconSvg(
    icon,
    12
  )}</span><span class="t">${escapeHtml(title)}</span></div>`;
}

function mainSection(
  icon: SectionIconKey,
  title: string,
  content: string
): string {
  if (!content) return "";
  return `<section class="sec">${secHeader(icon, title, "main")}${content}</section>`;
}

function sideSection(
  icon: SectionIconKey,
  title: string,
  content: string
): string {
  if (!content) return "";
  return `<section class="sec">${secHeader(icon, title, "side")}${content}</section>`;
}

function renderExperience(data: CvData): string {
  const entries = data.experience
    .map((item) => {
      const date = escapeHtml(
        formatDateRange(item.startDate, item.endDate, item.current)
      );
      const org = joinNonEmpty(
        [item.company, item.location].map(escapeHtml),
        " · "
      );
      const pill = date ? `<span class="pill">${date}</span>` : "";
      const orgLine = org ? `<p class="org">${org}</p>` : "";
      return `<div class="xp"><div class="top"><h3>${escapeHtml(
        item.position
      )}</h3>${pill}</div>${orgLine}${renderBullets(item.description)}</div>`;
    })
    .join("");
  return mainSection("experience", "Pengalaman Kerja", entries);
}

function renderProjects(data: CvData): string {
  const entries = data.projects
    .map((project) => {
      const heading = joinNonEmpty(
        [project.name, project.url].map(escapeHtml),
        " · "
      );
      return `<div class="blk"><h3>${heading}</h3>${renderBullets(
        project.description
      )}</div>`;
    })
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

function renderSkills(data: CvData): string {
  const bars = data.skills
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
  return sideSection("skills", "Keahlian", bars);
}

function renderEducation(data: CvData): string {
  const items = data.education
    .map((item) => {
      const degree = [item.degree, item.field].filter(Boolean).join(" ");
      const meta = joinNonEmpty(
        [
          escapeHtml(formatDateRange(item.startDate, item.endDate, false)),
          item.gpa.trim() ? `IPK ${escapeHtml(item.gpa)}` : "",
        ],
        " · "
      );
      return `<li><span class="name">${escapeHtml(
        item.institution
      )}</span><br/>${escapeHtml(degree)}${
        meta ? `<br/><span class="muted">${meta}</span>` : ""
      }</li>`;
    })
    .join("");
  return sideSection(
    "education",
    "Pendidikan",
    items ? `<ul class="side-list">${items}</ul>` : ""
  );
}

function renderLanguages(data: CvData): string {
  const items = data.languages
    .filter((language) => language.name.trim().length > 0)
    .map(
      (language) =>
        `<li class="lang-row"><span class="name">${escapeHtml(
          language.name
        )}</span><span class="muted">${escapeHtml(
          language.proficiency
        )}</span></li>`
    )
    .join("");
  return sideSection(
    "languages",
    "Bahasa",
    items ? `<ul class="side-list">${items}</ul>` : ""
  );
}

function renderCertifications(data: CvData): string {
  const items = data.certifications
    .map((certification) =>
      joinNonEmpty(
        [certification.name, certification.issuer].map(escapeHtml),
        " — "
      )
    )
    .filter((item) => item.length > 0)
    .map((item) => `<li>${item}</li>`)
    .join("");
  return sideSection(
    "certifications",
    "Sertifikasi",
    items ? `<ul class="side-list">${items}</ul>` : ""
  );
}

export function renderDesignerStudio(data: CvData): string {
  const summary = data.summary.trim()
    ? mainSection(
        "summary",
        "Tentang Saya",
        `<p class="muted">${escapeHtml(data.summary)}</p>`
      )
    : "";
  const main = [
    '<div class="main">',
    summary,
    renderExperience(data),
    renderProjects(data),
    renderCustom(data),
    "</div>",
  ].join("");
  const aside = [
    '<div class="aside">',
    renderSkills(data),
    renderEducation(data),
    renderLanguages(data),
    renderCertifications(data),
    "</div>",
  ].join("");
  const body = `${header(data)}<div class="accent"></div><div class="body">${main}${aside}</div>`;
  return documentShell(data.personal.fullName, css, body);
}
