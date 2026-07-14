import type { CvData } from "@/lib/cvData.js";
import {
  documentShell,
  escapeHtml,
  formatDateRange,
  joinNonEmpty,
  renderDescription,
  renderSummary,
} from "@/services/templates/shared.js";
import { getCvLabels } from "@/services/templates/i18n.js";
import { renderSkillGroups } from "@/services/templates/skills.js";
import { renderPhoto } from "@/services/templates/photo.js";

const css = `
* { box-sizing: border-box; }
body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; color: #404040; font-size: 10pt; line-height: 1.9; margin: 0; min-height: 100vh; padding: 52px 60px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 1px solid #e5e5e5; padding-bottom: 28px; margin-bottom: 4px; }
.header h1 { font-size: 30pt; font-weight: 300; letter-spacing: -0.5px; line-height: 1; margin: 0; color: #171717; }
.header .role { margin: 10px 0 0; font-size: 10.5pt; text-transform: uppercase; letter-spacing: 3px; color: #737373; }
.header .contact { margin: 12px 0 0; font-size: 9pt; color: #737373; }
.photo { width: 92px; height: 92px; border-radius: 50%; object-fit: cover; flex-shrink: 0; filter: grayscale(1); }
.section { margin-bottom: 4px; }
.section h2 { display: flex; align-items: center; gap: 12px; font-size: 8.5pt; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; color: #737373; margin: 28px 0 12px; }
.section h2::before { content: ""; width: 24px; height: 1px; background: #171717; flex-shrink: 0; }
.summary { max-width: 520px; }
.summary p { margin: 0; }
.rows { display: flex; flex-direction: column; gap: 18px; }
.rows.tight { gap: 12px; }
.row { display: grid; grid-template-columns: 130px 1fr; gap: 16px; }
.row .date { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 1px; color: #a3a3a3; margin: 2px 0 0; }
.row h3 { font-size: 10pt; font-weight: 500; color: #171717; margin: 0; }
.row .meta { font-size: 9pt; color: #737373; margin: 1px 0 0; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
.two-col .section { margin-bottom: 0; }
.skill-col { display: flex; flex-direction: column; gap: 2px; }
.plain-list { list-style: none; margin: 0; padding: 0; }
.plain-list li { margin-bottom: 2px; }
.muted { color: #a3a3a3; }
.entry { margin-bottom: 10px; }
.entry h3 { font-size: 10pt; font-weight: 500; color: #171717; margin: 0; }
.entry p { margin: 0; }
ul { margin: 6px 0 0; padding-left: 0; list-style: none; }
li { margin-bottom: 1px; }
.row ul { margin: 6px 0 0; }
p { margin: 3px 0; }
strong { font-weight: 700; }
em { font-style: italic; }
`;

function renderContact(data: CvData): string {
  const { personal } = data;
  const parts = joinNonEmpty(
    [
      personal.email,
      personal.phone,
      personal.address,
      ...personal.links.map((link) => link.url),
    ].map(escapeHtml),
    " &nbsp; &middot; &nbsp; "
  );
  return parts ? `<p class="contact">${parts}</p>` : "";
}

function renderExperience(data: CvData): string {
  if (!data.experience.length) return "";
  const t = getCvLabels(data.language);
  const rows = data.experience
    .map((exp) => {
      const date = formatDateRange(
        exp.startDate,
        exp.endDate,
        exp.current,
        data.language
      );
      const meta = joinNonEmpty(
        [escapeHtml(exp.company), escapeHtml(exp.location)],
        " &middot; "
      );
      const metaEl = meta ? `<p class="meta">${meta}</p>` : "";
      return `<div class="row"><p class="date">${escapeHtml(date)}</p><div><h3>${escapeHtml(exp.position)}</h3>${metaEl}${renderDescription(exp.description)}</div></div>`;
    })
    .join("");
  return `<section class="section"><h2>${escapeHtml(t.experience)}</h2><div class="rows">${rows}</div></section>`;
}

function renderEducation(data: CvData): string {
  if (!data.education.length) return "";
  const t = getCvLabels(data.language);
  const rows = data.education
    .map((edu) => {
      const date = formatDateRange(
        edu.startDate,
        edu.endDate,
        false,
        data.language
      );
      const degreeField = joinNonEmpty(
        [escapeHtml(edu.degree), escapeHtml(edu.field)],
        " "
      );
      const gpa = edu.gpa.trim() ? `${t.gpa} ${escapeHtml(edu.gpa)}` : "";
      const meta = joinNonEmpty(
        [degreeField, gpa, escapeHtml(edu.description)],
        " &middot; "
      );
      const metaEl = meta ? `<p class="meta">${meta}</p>` : "";
      return `<div class="row"><p class="date">${escapeHtml(date)}</p><div><h3>${escapeHtml(edu.institution)}</h3>${metaEl}</div></div>`;
    })
    .join("");
  return `<section class="section"><h2>${escapeHtml(t.education)}</h2><div class="rows tight">${rows}</div></section>`;
}

function renderSkills(data: CvData): string {
  if (!data.skills.length) return "";
  const t = getCvLabels(data.language);
  const content = renderSkillGroups(
    data.skills,
    (skill) =>
      skill.name.trim() ? `<div>${escapeHtml(skill.name)}</div>` : "",
    { groupTag: "div", groupClass: "skill-col" }
  );
  if (!content) return "";
  return `<section class="section"><h2>${escapeHtml(t.skills)}</h2>${content}</section>`;
}

function renderLanguages(data: CvData): string {
  const items = data.languages
    .map((lang) => {
      const name = escapeHtml(lang.name);
      if (!name) return "";
      const prof = lang.proficiency.trim()
        ? `<span class="muted"> &middot; ${escapeHtml(lang.proficiency)}</span>`
        : "";
      return `<li>${name}${prof}</li>`;
    })
    .filter(Boolean)
    .join("");
  if (!items) return "";
  const t = getCvLabels(data.language);
  return `<section class="section"><h2>${escapeHtml(t.languages)}</h2><ul class="plain-list">${items}</ul></section>`;
}

function renderCertifications(data: CvData): string {
  const items = data.certifications
    .map((cert) => {
      const name = escapeHtml(cert.name);
      if (!name) return "";
      const rest = joinNonEmpty(
        [
          escapeHtml(cert.issuer),
          escapeHtml(formatDateRange(cert.date, "", false, data.language)),
        ],
        " &middot; "
      );
      const restEl = rest ? `<span class="muted"> &middot; ${rest}</span>` : "";
      return `<li>${name}${restEl}</li>`;
    })
    .filter(Boolean)
    .join("");
  if (!items) return "";
  const t = getCvLabels(data.language);
  return `<section class="section"><h2>${escapeHtml(t.certifications)}</h2><ul class="plain-list">${items}</ul></section>`;
}

function renderProjects(data: CvData): string {
  if (!data.projects.length) return "";
  const t = getCvLabels(data.language);
  const entries = data.projects
    .map((project) => {
      const heading = joinNonEmpty(
        [project.name, project.url].map(escapeHtml),
        " &middot; "
      );
      return `<div class="entry"><h3>${heading}</h3>${renderDescription(project.description)}</div>`;
    })
    .join("");
  return `<section class="section"><h2>${escapeHtml(t.projects)}</h2>${entries}</section>`;
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
          return heading || item.body.trim()
            ? `<div class="entry">${heading}${renderDescription(item.body)}</div>`
            : "";
        })
        .join("");
      if (!items) return "";
      return `<section class="section"><h2>${escapeHtml(custom.title || t.other)}</h2>${items}</section>`;
    })
    .join("");
}

export function renderMinimalistCreative(data: CvData): string {
  const { personal } = data;
  const t = getCvLabels(data.language);
  const role = personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(personal.jobTitle)}</p>`
    : "";
  const header = `<header class="header"><div><h1>${escapeHtml(
    personal.fullName
  )}</h1>${role}${renderContact(data)}</div>${renderPhoto(personal.photoUrl)}</header>`;

  const summary = data.summary.trim()
    ? `<section class="section"><h2>${escapeHtml(t.summary)}</h2><div class="summary">${renderSummary(data.summary)}</div></section>`
    : "";

  const skillsLang =
    renderSkills(data) || renderLanguages(data)
      ? `<div class="two-col"><div>${renderSkills(data)}</div><div>${renderLanguages(data)}</div></div>`
      : "";

  const body = `<main>${header}${summary}${renderExperience(data)}${renderEducation(
    data
  )}${skillsLang}${renderProjects(data)}${renderCertifications(data)}${renderCustom(data)}</main>`;
  return documentShell(personal.fullName, css, body, data.language);
}
