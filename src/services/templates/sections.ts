import type { CvData } from "@/lib/cvData.js";
import {
  escapeHtml,
  formatDateRange,
  joinNonEmpty,
  renderDescription,
  renderSummary,
} from "@/services/templates/shared.js";
import { getCvLabels } from "@/services/templates/i18n.js";
import { renderSkillGroupsInline } from "@/services/templates/skills.js";

function section(title: string, content: string, className = ""): string {
  if (!content) return "";
  const classes = joinNonEmpty(["section", className], " ");
  return `<section class="${classes}"><h2>${escapeHtml(title)}</h2>${content}</section>`;
}

/**
 * Entry heading row shared by experience / education: the title (position or
 * institution) on the left and the date range right-aligned on the same
 * baseline — mirroring the live preview, where each entry is a
 * `[bold title | date]` flex row. Both arguments are pre-escaped by the caller.
 */
function entryHead(title: string, date: string): string {
  const titleEl = title ? `<h3>${title}</h3>` : "";
  const dateEl = date ? `<span class="entry-date">${date}</span>` : "";
  if (!titleEl && !dateEl) return "";
  return `<div class="entry-head">${titleEl}${dateEl}</div>`;
}

/** email &middot; phone &middot; address — the first contact line (no links). */
export function renderContactBase(data: CvData): string {
  const base = [data.personal.email, data.personal.phone, data.personal.address]
    .filter((part) => part.trim().length > 0)
    .map(escapeHtml);
  return joinNonEmpty(base, " &middot; ");
}

/**
 * The links line ("Label: url" &middot; …). Matches the preview, which shows a
 * link's `label: url` when both exist and just the url otherwise (label-only
 * links are dropped).
 */
export function renderLinksLine(data: CvData): string {
  const links = data.personal.links.map((link) =>
    link.label && link.url
      ? `${escapeHtml(link.label)}: ${escapeHtml(link.url)}`
      : escapeHtml(link.url)
  );
  return joinNonEmpty(links, " &middot; ");
}

/**
 * Single merged contact line (base + links). Kept for templates that render a
 * one-line header themselves; the standard {@link renderHeader} uses the split
 * base/links lines to match the live preview.
 */
export function renderContactLine(data: CvData): string {
  return joinNonEmpty(
    [renderContactBase(data), renderLinksLine(data)],
    " &middot; "
  );
}

export function renderHeader(data: CvData): string {
  const name = escapeHtml(data.personal.fullName);
  const role = data.personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(data.personal.jobTitle)}</p>`
    : "";
  const base = renderContactBase(data);
  const links = renderLinksLine(data);
  const contactLine = base ? `<p class="contact">${base}</p>` : "";
  // Links go on their own line (class "contact links") so per-template contact
  // styling applies to both and the two lines match the preview's two rows.
  const linksLine = links ? `<p class="contact links">${links}</p>` : "";
  return `<header class="header"><h1>${name}</h1>${role}${contactLine}${linksLine}</header>`;
}

export function renderSummarySection(data: CvData): string {
  if (!data.summary.trim()) return "";
  return section(
    getCvLabels(data.language).summary,
    renderSummary(data.summary)
  );
}

export function renderExperienceSection(data: CvData): string {
  const entries = data.experience
    .map((experience) => {
      const head = entryHead(
        escapeHtml(experience.position),
        escapeHtml(
          formatDateRange(
            experience.startDate,
            experience.endDate,
            experience.current,
            data.language
          )
        )
      );
      const meta = joinNonEmpty(
        [experience.company, experience.location].map(escapeHtml),
        ", "
      );
      const metaLine = meta ? `<p class="meta">${meta}</p>` : "";
      const description = renderDescription(experience.description);
      return `<article class="entry">${head}${metaLine}${description}</article>`;
    })
    .join("");
  return section(getCvLabels(data.language).experience, entries);
}

export function renderEducationSection(data: CvData): string {
  const entries = data.education
    .map((education) => {
      const head = entryHead(
        escapeHtml(education.institution),
        escapeHtml(
          formatDateRange(
            education.startDate,
            education.endDate,
            false,
            data.language
          )
        )
      );
      const degreeField = joinNonEmpty(
        [education.degree, education.field].map(escapeHtml),
        " "
      );
      const gpa = education.gpa.trim()
        ? `${getCvLabels(data.language).gpa} ${escapeHtml(education.gpa)}`
        : "";
      const meta = joinNonEmpty(
        [degreeField, gpa, escapeHtml(education.description)],
        " &middot; "
      );
      const metaLine = meta ? `<p class="meta">${meta}</p>` : "";
      return `<article class="entry">${head}${metaLine}</article>`;
    })
    .join("");
  return section(getCvLabels(data.language).education, entries);
}

export function renderSkillsSection(
  data: CvData,
  options: { separator?: string } = {}
): string {
  const content = renderSkillGroupsInline(data.skills, {
    separator: options.separator,
  });
  return section(getCvLabels(data.language).skills, content);
}

export function renderProjectsSection(data: CvData): string {
  const entries = data.projects
    .map((project) => {
      const heading = joinNonEmpty(
        [project.name, project.url].map(escapeHtml),
        " &mdash; "
      );
      const description = renderDescription(project.description);
      return heading || description
        ? `<article class="entry"><h3>${heading}</h3>${description}</article>`
        : "";
    })
    .join("");
  return section(getCvLabels(data.language).projects, entries);
}

export function renderCertificationsSection(data: CvData): string {
  const items = data.certifications
    .map((certification) => {
      const nameIssuer = joinNonEmpty(
        [certification.name, certification.issuer].map(escapeHtml),
        " &mdash; "
      );
      if (!nameIssuer) return "";
      const date = formatDateRange(
        certification.date,
        "",
        false,
        data.language
      );
      const dateSuffix = date ? ` (${escapeHtml(date)})` : "";
      return `<li>${nameIssuer}${dateSuffix}</li>`;
    })
    .filter((item) => item.length > 0)
    .join("");
  return section(
    getCvLabels(data.language).certifications,
    items ? `<ul>${items}</ul>` : ""
  );
}

/** One "name (proficiency)" fragment per language, non-empty only. */
export function renderLanguageItems(data: CvData): string[] {
  return data.languages
    .map((language) => {
      const name = escapeHtml(language.name);
      if (!name) return "";
      const proficiency = language.proficiency.trim()
        ? ` (${escapeHtml(language.proficiency)})`
        : "";
      return `${name}${proficiency}`;
    })
    .filter((item) => item.length > 0);
}

export function renderLanguagesSection(data: CvData): string {
  const items = renderLanguageItems(data);
  // Inline, comma-free single line ("English (Native) · Spanish (Fluent)") —
  // matches the preview, which joins languages on one line rather than a list.
  return section(
    getCvLabels(data.language).languages,
    items.length ? `<p class="lang-line">${items.join(" &middot; ")}</p>` : ""
  );
}

export function renderCustomSections(data: CvData): string {
  return data.customSections
    .map((custom) => {
      const items = custom.items
        .map((item) => {
          const heading = item.heading.trim()
            ? `<h3>${escapeHtml(item.heading)}</h3>`
            : "";
          const bodyHtml = renderDescription(item.body);
          const body = bodyHtml ? bodyHtml : "";
          return heading || body
            ? `<article class="entry">${heading}${body}</article>`
            : "";
        })
        .join("");
      return section(custom.title || getCvLabels(data.language).other, items);
    })
    .join("");
}

/** Assemble the standard single-column body in the default section order. */
export function renderBodySections(
  data: CvData,
  options: { skillsSeparator?: string } = {}
): string {
  return [
    renderSummarySection(data),
    renderExperienceSection(data),
    renderEducationSection(data),
    renderSkillsSection(data, { separator: options.skillsSeparator }),
    renderProjectsSection(data),
    renderCertificationsSection(data),
    renderLanguagesSection(data),
    renderCustomSections(data),
  ].join("");
}
