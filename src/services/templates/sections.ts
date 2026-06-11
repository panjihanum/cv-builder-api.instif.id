import type { CvData } from "@/lib/cvData.js";
import {
  escapeHtml,
  formatDateRange,
  joinNonEmpty,
  renderMultiline,
} from "@/services/templates/shared.js";

function section(title: string, content: string, className = ""): string {
  if (!content) return "";
  const classes = joinNonEmpty(["section", className], " ");
  return `<section class="${classes}"><h2>${escapeHtml(title)}</h2>${content}</section>`;
}

export function renderContactLine(data: CvData): string {
  const links = data.personal.links.map((link) =>
    joinNonEmpty([link.label, link.url].map(escapeHtml), ": ")
  );
  const base = [data.personal.email, data.personal.phone, data.personal.address]
    .filter((part) => part.trim().length > 0)
    .map(escapeHtml);
  return joinNonEmpty([...base, ...links], " &middot; ");
}

export function renderHeader(data: CvData): string {
  const name = escapeHtml(data.personal.fullName);
  const role = data.personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(data.personal.jobTitle)}</p>`
    : "";
  const contact = renderContactLine(data);
  const contactLine = contact ? `<p class="contact">${contact}</p>` : "";
  return `<header class="header"><h1>${name}</h1>${role}${contactLine}</header>`;
}

export function renderSummarySection(data: CvData): string {
  if (!data.summary.trim()) return "";
  return section("Summary", `<p>${renderMultiline(data.summary)}</p>`);
}

export function renderExperienceSection(data: CvData): string {
  const entries = data.experience
    .map((experience) => {
      const heading = joinNonEmpty(
        [experience.position, experience.company].map(escapeHtml),
        " &mdash; "
      );
      const meta = joinNonEmpty(
        [
          escapeHtml(experience.location),
          escapeHtml(
            formatDateRange(
              experience.startDate,
              experience.endDate,
              experience.current
            )
          ),
        ],
        " &middot; "
      );
      const description = experience.description.trim()
        ? `<p>${renderMultiline(experience.description)}</p>`
        : "";
      const metaLine = meta ? `<p class="meta">${meta}</p>` : "";
      return `<article class="entry"><h3>${heading}</h3>${metaLine}${description}</article>`;
    })
    .join("");
  return section("Work Experience", entries);
}

export function renderEducationSection(data: CvData): string {
  const entries = data.education
    .map((education) => {
      const heading = joinNonEmpty(
        [education.institution].map(escapeHtml),
        " "
      );
      const detail = joinNonEmpty(
        [education.degree, education.field].map(escapeHtml),
        ", "
      );
      const gpa = education.gpa.trim()
        ? `GPA ${escapeHtml(education.gpa)}`
        : "";
      const meta = joinNonEmpty(
        [
          detail,
          escapeHtml(
            formatDateRange(education.startDate, education.endDate, false)
          ),
          gpa,
        ],
        " &middot; "
      );
      const description = education.description.trim()
        ? `<p>${renderMultiline(education.description)}</p>`
        : "";
      const metaLine = meta ? `<p class="meta">${meta}</p>` : "";
      return `<article class="entry"><h3>${heading}</h3>${metaLine}${description}</article>`;
    })
    .join("");
  return section("Education", entries);
}

export function renderSkillItems(data: CvData): string {
  return data.skills
    .map(
      (skill) =>
        `<li>${escapeHtml(skill.name)} <span class="level">(${skill.level}/5)</span></li>`
    )
    .join("");
}

export function renderSkillsSection(data: CvData): string {
  const items = renderSkillItems(data);
  return section(
    "Skills",
    items ? `<ul class="inline-list">${items}</ul>` : ""
  );
}

export function renderProjectsSection(data: CvData): string {
  const entries = data.projects
    .map((project) => {
      const heading = joinNonEmpty(
        [project.name, project.url].map(escapeHtml),
        " &middot; "
      );
      const description = project.description.trim()
        ? `<p>${renderMultiline(project.description)}</p>`
        : "";
      return `<article class="entry"><h3>${heading}</h3>${description}</article>`;
    })
    .join("");
  return section("Projects", entries);
}

export function renderCertificationsSection(data: CvData): string {
  const items = data.certifications
    .map((certification) =>
      joinNonEmpty(
        [certification.name, certification.issuer, certification.date].map(
          escapeHtml
        ),
        " &middot; "
      )
    )
    .filter((item) => item.length > 0)
    .map((item) => `<li>${item}</li>`)
    .join("");
  return section("Certifications", items ? `<ul>${items}</ul>` : "");
}

export function renderLanguageItems(data: CvData): string {
  return data.languages
    .map((language) =>
      joinNonEmpty(
        [language.name, language.proficiency].map(escapeHtml),
        " &mdash; "
      )
    )
    .filter((item) => item.length > 0)
    .map((item) => `<li>${item}</li>`)
    .join("");
}

export function renderLanguagesSection(data: CvData): string {
  const items = renderLanguageItems(data);
  return section("Languages", items ? `<ul>${items}</ul>` : "");
}

export function renderCustomSections(data: CvData): string {
  return data.customSections
    .map((custom) => {
      const items = custom.items
        .map((item) => {
          const heading = item.heading.trim()
            ? `<h3>${escapeHtml(item.heading)}</h3>`
            : "";
          const body = item.body.trim()
            ? `<p>${renderMultiline(item.body)}</p>`
            : "";
          return heading || body
            ? `<article class="entry">${heading}${body}</article>`
            : "";
        })
        .join("");
      return section(custom.title || "Other", items);
    })
    .join("");
}

export function renderBodySections(data: CvData): string {
  return [
    renderSummarySection(data),
    renderExperienceSection(data),
    renderEducationSection(data),
    renderSkillsSection(data),
    renderProjectsSection(data),
    renderCertificationsSection(data),
    renderLanguagesSection(data),
    renderCustomSections(data),
  ].join("");
}
