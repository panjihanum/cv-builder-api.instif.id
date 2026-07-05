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
  const contact = toListItems(
    [data.personal.email, data.personal.phone, data.personal.address].map(
      escapeHtml
    )
  );
  const links = toListItems(
    data.personal.links.map((link) =>
      joinNonEmpty([link.label, link.url].map(escapeHtml), ": ")
    )
  );
  const skills = renderSkillGroups(
    data.skills,
    (skill) =>
      skill.name.trim().length > 0
        ? `<li class="skill-row"><span>${escapeHtml(skill.name)}</span><span class="dots">${renderSkillDots(skill.level)}</span></li>`
        : "",
    { groupTag: "ul" }
  );
  const languages = toListItems(
    data.languages.map((language) =>
      joinNonEmpty(
        [language.name, language.proficiency].map(escapeHtml),
        " &mdash; "
      )
    )
  );
  return [
    '<aside class="sidebar">',
    renderPhoto(data.personal.photoUrl),
    sidebarBlock(t.contact, contact),
    sidebarBlock("Tautan", links),
    skills ? `<h2>${escapeHtml(t.skills)}</h2>${skills}` : "",
    sidebarBlock(t.languages, languages),
    "</aside>",
  ].join("");
}
