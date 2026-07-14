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
body { font-family: Helvetica, Arial, sans-serif; color: #262626; font-size: 10pt; line-height: 1.55; margin: 0; min-height: 100vh; padding: 44px 48px; }
.header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; border-bottom: 3px solid #064e3b; padding-bottom: 14px; margin-bottom: 15px; }
.header .id { flex: 1; }
.header h1 { font-size: 23pt; margin: 0 0 3px; letter-spacing: -0.4px; color: #022c22; font-weight: 800; }
.header .role { margin: 0 0 6px; font-size: 11.5pt; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #047857; }
.header .contact { margin: 0; font-size: 9pt; color: #737373; }
.photo { width: 84px; height: 84px; object-fit: cover; flex-shrink: 0; border: 2px solid #064e3b; }
.section { margin-bottom: 14px; }
.section h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: 1.8px; color: #064e3b; font-weight: 700; border-bottom: 1px solid #d1fae5; padding-bottom: 4px; margin: 0 0 8px; }
.summary { border-left: 3px solid #059669; background: #ecfdf5; padding: 5px 0 5px 14px; font-style: italic; color: #404040; }
.summary p { margin: 0; }
.tl { display: flex; flex-direction: column; }
.tl .entry { position: relative; border-left: 2px solid #a7f3d0; padding: 0 0 16px 18px; margin: 0; }
.tl .entry::before { content: ""; position: absolute; left: -5px; top: 5px; width: 8px; height: 8px; border-radius: 50%; background: #065f46; }
.tl .date { font-size: 9pt; font-weight: 600; color: #047857; margin: 0; }
.tl .entry h3 { font-size: 10.5pt; margin: 2px 0 0; font-weight: 700; color: #171717; }
.tl .meta { font-size: 9pt; color: #737373; margin: 0; }
.tl .entry ul { margin: 4px 0 0; padding-left: 17px; color: #404040; }
.edu .entry { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.edu h3 { font-size: 10.5pt; margin: 0; font-weight: 700; color: #171717; }
.edu .meta { font-size: 9pt; color: #737373; margin: 1px 0 0; }
.edu .date { font-size: 9pt; font-weight: 600; color: #047857; flex-shrink: 0; }
.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.two-col .section { margin-bottom: 0; }
.skill-list { list-style: none; margin: 0; padding: 0; }
.skill-list li { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
.skill-list li::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #065f46; flex-shrink: 0; }
.plain-list { list-style: none; margin: 0; padding: 0; }
.plain-list li { margin-bottom: 3px; }
.entry { margin-bottom: 9px; }
.entry h3 { font-size: 10.5pt; margin: 0; font-weight: 700; color: #171717; }
.entry ul { margin: 3px 0 0; padding-left: 17px; color: #404040; }
.entry p { margin: 0; }
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
    " | "
  );
  return parts ? `<p class="contact">${parts}</p>` : "";
}

function renderExperience(data: CvData): string {
  if (!data.experience.length) return "";
  const t = getCvLabels(data.language);
  const entries = data.experience
    .map((exp) => {
      const date = formatDateRange(
        exp.startDate,
        exp.endDate,
        exp.current,
        data.language
      );
      const dateEl = date ? `<p class="date">${escapeHtml(date)}</p>` : "";
      const meta = joinNonEmpty(
        [escapeHtml(exp.company), escapeHtml(exp.location)],
        " | "
      );
      const metaEl = meta ? `<p class="meta">${meta}</p>` : "";
      return `<div class="entry">${dateEl}<h3>${escapeHtml(exp.position)}</h3>${metaEl}${renderDescription(exp.description)}</div>`;
    })
    .join("");
  return `<section class="section"><h2>${escapeHtml(t.experience)}</h2><div class="tl">${entries}</div></section>`;
}

function renderEducation(data: CvData): string {
  if (!data.education.length) return "";
  const t = getCvLabels(data.language);
  const entries = data.education
    .map((edu) => {
      const date = formatDateRange(
        edu.startDate,
        edu.endDate,
        false,
        data.language
      );
      const dateEl = date ? `<p class="date">${escapeHtml(date)}</p>` : "";
      const degreeField = joinNonEmpty(
        [escapeHtml(edu.degree), escapeHtml(edu.field)],
        " "
      );
      const gpa = edu.gpa.trim() ? `${t.gpa} ${escapeHtml(edu.gpa)}` : "";
      const meta = joinNonEmpty([degreeField, gpa], " | ");
      const metaEl = meta ? `<p class="meta">${meta}</p>` : "";
      return `<div class="entry"><div><h3>${escapeHtml(edu.institution)}</h3>${metaEl}</div>${dateEl}</div>`;
    })
    .join("");
  return `<section class="section edu"><h2>${escapeHtml(t.education)}</h2>${entries}</section>`;
}

function renderSkills(data: CvData): string {
  if (!data.skills.length) return "";
  const t = getCvLabels(data.language);
  const content = renderSkillGroups(
    data.skills,
    (skill) => (skill.name.trim() ? `<li>${escapeHtml(skill.name)}</li>` : ""),
    { groupClass: "skill-list" }
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
        ? ` &mdash; ${escapeHtml(lang.proficiency)}`
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
    .map((cert) =>
      joinNonEmpty([cert.name, cert.issuer].map(escapeHtml), " &mdash; ")
    )
    .filter(Boolean)
    .map((item) => `<li>${item}</li>`)
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
        " | "
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

export function renderExecutiveSenior(data: CvData): string {
  const { personal } = data;
  const t = getCvLabels(data.language);
  const role = personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(personal.jobTitle)}</p>`
    : "";
  const header = `<header class="header"><div class="id"><h1>${escapeHtml(
    personal.fullName
  )}</h1>${role}${renderContact(data)}</div>${renderPhoto(personal.photoUrl)}</header>`;

  const summary = data.summary.trim()
    ? `<section class="section"><h2>${escapeHtml(t.summary)}</h2><div class="summary">${renderSummary(data.summary)}</div></section>`
    : "";

  const sideRight = `${renderLanguages(data)}${renderCertifications(data)}`;
  const twoCol =
    renderSkills(data) || sideRight
      ? `<div class="two-col"><div>${renderSkills(data)}</div><div>${sideRight}</div></div>`
      : "";

  const body = `<main>${header}${summary}${renderExperience(data)}${renderEducation(
    data
  )}${twoCol}${renderProjects(data)}${renderCustom(data)}</main>`;
  return documentShell(personal.fullName, css, body, data.language);
}
