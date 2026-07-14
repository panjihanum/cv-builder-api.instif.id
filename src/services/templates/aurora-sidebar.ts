import type { CvData } from "@/lib/cvData.js";
import { escapeHtml, joinNonEmpty } from "@/services/templates/shared.js";
import { getCvLabels } from "@/services/templates/i18n.js";
import { renderPhoto } from "@/services/templates/photo.js";
import { renderSkillGroups } from "@/services/templates/skills.js";

function sidebarBlock(title: string, items: string): string {
  if (!items) return "";
  return `<h2>${escapeHtml(title)}</h2><ul>${items}</ul>`;
}

function toListItems(values: string[]): string {
  return values
    .filter((value) => value.trim().length > 0)
    .map((value) => `<li>${value}</li>`)
    .join("");
}

function renderSkillDots(level: number): string {
  const filled = Math.min(Math.max(level, 0), 5);
  return `${"●".repeat(filled)}${"○".repeat(5 - filled)}`;
}

export function renderAuroraSidebar(data: CvData): string {
  const t = getCvLabels(data.language);
  const { personal } = data;
  const role = personal.jobTitle.trim()
    ? `<p class="s-role">${escapeHtml(personal.jobTitle)}</p>`
    : "";
  // Contact and links live in a single list (as in the preview), not a separate
  // "Tautan" block.
  const contact = toListItems([
    ...[personal.email, personal.phone, personal.address].map(escapeHtml),
    ...personal.links.map((link) =>
      link.label && link.url
        ? `${escapeHtml(link.label)}: ${escapeHtml(link.url)}`
        : escapeHtml(link.url)
    ),
  ]);
  const skills = renderSkillGroups(
    data.skills,
    (skill) =>
      skill.name.trim().length > 0
        ? `<li class="skill-row"><span>${escapeHtml(skill.name)}</span><span class="dots">${renderSkillDots(skill.level)}</span></li>`
        : "",
    { groupTag: "ul" }
  );
  const languages = toListItems(
    data.languages.map((language) => {
      const name = escapeHtml(language.name);
      if (!name) return "";
      return language.proficiency.trim()
        ? `${name} (${escapeHtml(language.proficiency)})`
        : name;
    })
  );
  const certifications = toListItems(
    data.certifications.map((certification) =>
      joinNonEmpty(
        [certification.name, certification.issuer].map(escapeHtml),
        " &mdash; "
      )
    )
  );
  return [
    '<aside class="sidebar">',
    renderPhoto(personal.photoUrl),
    `<h1 class="s-name">${escapeHtml(personal.fullName)}</h1>`,
    role,
    sidebarBlock(t.contact, contact),
    skills ? `<h2>${escapeHtml(t.skills)}</h2>${skills}` : "",
    sidebarBlock(t.languages, languages),
    sidebarBlock(t.certifications, certifications),
    "</aside>",
  ].join("");
}
