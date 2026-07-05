import type { CvData } from "@/lib/cvData.js";
import {
  documentShell,
  escapeHtml,
  formatDateRange,
  joinNonEmpty,
  renderDescription,
  renderSummary,
} from "@/services/templates/shared.js";
import { renderSkillGroups } from "@/services/templates/skills.js";
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
import { getCvLabels } from "@/services/templates/i18n.js";
import { photoToDataUrl } from "@/services/templates/photo.js";

const BLOB_A =
  "M44.5,-57.2C57.9,-47.4,69,-33.8,72.6,-18.4C76.2,-3,72.3,14.2,63.8,28.1C55.3,42,42.2,52.6,27.6,59.4C13,66.2,-3.1,69.2,-18.5,65.7C-33.9,62.2,-48.6,52.2,-58.9,38.6C-69.2,25,-75.1,7.8,-72.6,-8C-70.1,-23.8,-59.2,-38.2,-46,-48C-32.8,-57.8,-16.4,-63,0.3,-63.4C17,-63.8,34,-67,44.5,-57.2Z";
const BLOB_B =
  "M38.6,-50.4C49.3,-41.9,56.4,-29,60.3,-14.9C64.2,-0.8,64.9,14.5,58.8,26.6C52.7,38.7,39.8,47.6,25.8,53.9C11.8,60.2,-3.3,63.9,-17.3,60.7C-31.3,57.5,-44.2,47.4,-52.3,34.4C-60.4,21.4,-63.7,5.5,-61,-9.2C-58.3,-23.9,-49.6,-37.4,-37.8,-46C-26,-54.6,-13,-58.3,0.8,-59.4C14.6,-60.5,29.2,-58.9,38.6,-50.4Z";
const LEAF = "M12,2C6,7 4,14 12,22C20,14 18,7 12,2Z";

const decorTopRight = `<svg class="decor tr" viewBox="0 0 200 200">
<g transform="translate(100 100)">
<path d="${BLOB_A}" fill="#5eead4" opacity="0.55"></path>
<path d="${BLOB_B}" transform="translate(34 26) scale(0.6)" fill="#fbbf24" opacity="0.8"></path>
<circle cx="-34" cy="40" r="11" fill="#fb7185" opacity="0.85"></circle>
</g>
<path d="${LEAF}" transform="translate(36 128) rotate(40) scale(1.6)" fill="#0d9488"></path>
<path d="${LEAF}" transform="translate(20 150) rotate(-15) scale(1.2)" fill="#f59e0b"></path>
<circle cx="60" cy="172" r="4" fill="#fb7185"></circle>
</svg>`;

const decorBottomLeft = `<svg class="decor bl" viewBox="0 0 200 200">
<g transform="translate(100 100)">
<path d="${BLOB_B}" fill="#fcd34d" opacity="0.55"></path>
<path d="${BLOB_A}" transform="translate(-30 -28) scale(0.5)" fill="#2dd4bf" opacity="0.75"></path>
<circle cx="40" cy="-38" r="9" fill="#fb7185" opacity="0.85"></circle>
</g>
<path d="${LEAF}" transform="translate(150 44) rotate(200) scale(1.5)" fill="#0d9488"></path>
<circle cx="150" cy="20" r="4" fill="#f59e0b"></circle>
</svg>`;

const css = `
* { box-sizing: border-box; }
body { font-family: Helvetica, Arial, sans-serif; color: #334155; font-size: 9.5pt; line-height: 1.5; margin: 0; }
.page { position: relative; overflow: hidden; min-height: 100vh; padding: 0 34px; background: #ffffff; }
.decor { position: absolute; pointer-events: none; }
.decor.tr { top: -60px; right: -60px; width: 280px; height: 280px; }
.decor.bl { bottom: -60px; left: -60px; width: 250px; height: 250px; }
.content { position: relative; z-index: 1; }
.head { display: flex; align-items: flex-start; gap: 18px; }
.head .photo { width: 92px; height: 92px; border-radius: 50%; object-fit: cover; border: 4px solid #ccfbf1; }
.head h1 { margin: 0; font-size: 23pt; font-weight: 800; letter-spacing: -0.5px; color: #0f766e; }
.head .role { margin: 3px 0 0; font-size: 9.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 4px; color: #f59e0b; }
.contact { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 9px; font-size: 8.5pt; color: #64748b; }
.chip { display: inline-flex; align-items: center; gap: 5px; }
.cols { display: grid; grid-template-columns: 1.25fr 1fr; gap: 0 30px; margin-top: 26px; }
.col > section { margin-bottom: 20px; }
.col > section:last-child { margin-bottom: 0; }
.sec-h { display: flex; align-items: center; gap: 9px; margin: 0 0 9px; }
.sec-h .ic { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; color: #ffffff; }
.sec-h .ic.teal { background: linear-gradient(135deg,#14b8a6,#0d9488); }
.sec-h .ic.amber { background: linear-gradient(135deg,#fbbf24,#f59e0b); }
.sec-h .ic.coral { background: linear-gradient(135deg,#fb7185,#f43f5e); }
.sec-h .t { font-size: 10.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #334155; }
.entry { margin-bottom: 11px; }
.entry .top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.entry h3 { margin: 0; font-size: 10pt; color: #0f172a; }
.entry .date { font-size: 8pt; font-weight: 600; color: #d97706; white-space: nowrap; }
.entry .org { margin: 1px 0 2px; font-size: 8.5pt; font-weight: 500; color: #0d9488; }
.entry ul, .blk ul { margin: 3px 0 0; padding-left: 16px; color: #475569; }
.blk { margin-bottom: 8px; }
.blk h3 { margin: 0; font-size: 9.5pt; color: #0f172a; }
.bar-row { margin-bottom: 8px; }
.bar-row .lbl { font-size: 8.5pt; color: #334155; margin-bottom: 3px; }
.bar { height: 5px; width: 100%; background: #ccfbf1; border-radius: 999px; }
.bar > span { display: block; height: 5px; border-radius: 999px; background: linear-gradient(90deg,#2dd4bf,#f59e0b); }
.edu { margin-bottom: 8px; }
.edu .name { font-weight: 700; color: #0f172a; font-size: 9.5pt; }
.edu .deg { font-size: 8.5pt; color: #475569; }
.edu .meta { font-size: 8pt; color: #94a3b8; }
.list { list-style: none; margin: 0; padding: 0; font-size: 8.5pt; color: #475569; }
.list li { margin-bottom: 4px; }
.list li.lang { display: flex; justify-content: space-between; gap: 6px; }
.list .name { font-weight: 600; color: #334155; }
.list .pro { color: #94a3b8; }
.muted { color: #475569; }
p { margin: 0; }
`;

type Tone = "teal" | "amber" | "coral";

function clampLevel(level: number): number {
  return Math.min(Math.max(level, 1), 5);
}

function chip(iconSvg: string, text: string): string {
  if (!text.trim()) return "";
  return `<span class="chip">${iconSvg}<span>${escapeHtml(text)}</span></span>`;
}

function secHeader(icon: SectionIconKey, title: string, tone: Tone): string {
  return `<div class="sec-h"><span class="ic ${tone}">${sectionIconSvg(
    icon,
    13
  )}</span><span class="t">${escapeHtml(title)}</span></div>`;
}

function section(
  icon: SectionIconKey,
  title: string,
  tone: Tone,
  content: string
): string {
  if (!content) return "";
  return `<section>${secHeader(icon, title, tone)}${content}</section>`;
}

function renderHead(data: CvData): string {
  const photoSrc = photoToDataUrl(data.personal.photoUrl);
  const photo = photoSrc
    ? `<img class="photo" src="${escapeHtml(photoSrc)}" alt="" />`
    : "";
  const role = data.personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(data.personal.jobTitle)}</p>`
    : "";
  const contacts = [
    chip(linkIconSvg("mail", 12, true), data.personal.email),
    chip(linkIconSvg("phone", 12, true), data.personal.phone),
    chip(linkIconSvg("location", 12, true), data.personal.address),
    ...data.personal.links.map((link) =>
      chip(linkIconSvg(resolveLinkIcon(link), 12, true), formatLinkText(link))
    ),
  ].join("");
  return `<header class="head">${photo}<div><h1>${escapeHtml(
    data.personal.fullName
  )}</h1>${role}<div class="contact">${contacts}</div></div></header>`;
}

function renderExperience(data: CvData): string {
  const t = getCvLabels(data.language);
  const entries = data.experience
    .map((item) => {
      const date = escapeHtml(
        formatDateRange(
          item.startDate,
          item.endDate,
          item.current,
          data.language
        )
      );
      const org = joinNonEmpty(
        [item.company, item.location].map(escapeHtml),
        " · "
      );
      return `<div class="entry"><div class="top"><h3>${escapeHtml(
        item.position
      )}</h3><span class="date">${date}</span></div>${
        org ? `<p class="org">${org}</p>` : ""
      }${renderDescription(item.description)}</div>`;
    })
    .join("");
  return section("experience", t.experience, "amber", entries);
}

function renderCustom(data: CvData): string {
  const t = getCvLabels(data.language);
  return data.customSections
    .map((custom) => {
      const items = custom.items
        .map((item) => {
          const heading = item.heading.trim()
            ? `<h3>${escapeHtml(item.heading)}</h3>`
            : "";
          return `<div class="blk">${heading}${renderDescription(item.body)}</div>`;
        })
        .join("");
      return section(
        resolveSectionIcon(custom.icon, "custom"),
        custom.title || t.other,
        "coral",
        items
      );
    })
    .join("");
}

function renderEducation(data: CvData): string {
  const t = getCvLabels(data.language);
  const entries = data.education
    .map((item) => {
      const degree = [item.degree, item.field].filter(Boolean).join(" ");
      const meta = joinNonEmpty(
        [
          escapeHtml(
            formatDateRange(item.startDate, item.endDate, false, data.language)
          ),
          item.gpa.trim() ? `${t.gpa} ${escapeHtml(item.gpa)}` : "",
        ],
        " · "
      );
      return `<div class="edu"><div class="name">${escapeHtml(
        item.institution
      )}</div>${degree ? `<div class="deg">${escapeHtml(degree)}</div>` : ""}${
        meta ? `<div class="meta">${meta}</div>` : ""
      }</div>`;
    })
    .join("");
  return section("education", t.education, "teal", entries);
}

function renderSkills(data: CvData): string {
  const t = getCvLabels(data.language);
  const bars = renderSkillGroups(
    data.skills,
    (skill) =>
      skill.name.trim().length > 0
        ? `<div class="bar-row"><div class="lbl">${escapeHtml(
            skill.name
          )}</div><div class="bar"><span style="width:${
            (clampLevel(skill.level) / 5) * 100
          }%"></span></div></div>`
        : "",
    { groupTag: "div" }
  );
  return section("skills", t.skills, "amber", bars);
}

function renderLanguages(data: CvData): string {
  const t = getCvLabels(data.language);
  const items = data.languages
    .filter((language) => language.name.trim().length > 0)
    .map(
      (language) =>
        `<li class="lang"><span class="name">${escapeHtml(
          language.name
        )}</span><span class="pro">${escapeHtml(language.proficiency)}</span></li>`
    )
    .join("");
  return section(
    "languages",
    t.languages,
    "coral",
    items ? `<ul class="list">${items}</ul>` : ""
  );
}

function renderCertifications(data: CvData): string {
  const t = getCvLabels(data.language);
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
  return section(
    "certifications",
    t.certifications,
    "teal",
    items ? `<ul class="list">${items}</ul>` : ""
  );
}

function renderProjects(data: CvData): string {
  const t = getCvLabels(data.language);
  const entries = data.projects
    .map(
      (project) =>
        `<div class="blk"><h3>${joinNonEmpty(
          [project.name, project.url].map(escapeHtml),
          " · "
        )}</h3>${renderDescription(project.description)}</div>`
    )
    .join("");
  return section("projects", t.projects, "amber", entries);
}

export function renderBloom(data: CvData): string {
  const t = getCvLabels(data.language);
  const summary = data.summary.trim()
    ? section(
        "summary",
        t.summary,
        "teal",
        renderSummary(data.summary, "muted")
      )
    : "";
  const left = [
    '<div class="col">',
    summary,
    renderExperience(data),
    renderCustom(data),
    "</div>",
  ].join("");
  const right = [
    '<div class="col">',
    renderEducation(data),
    renderSkills(data),
    renderLanguages(data),
    renderCertifications(data),
    renderProjects(data),
    "</div>",
  ].join("");
  const body = `<div class="page">${decorTopRight}${decorBottomLeft}<div class="content">${renderHead(
    data
  )}<div class="cols">${left}${right}</div></div></div>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
