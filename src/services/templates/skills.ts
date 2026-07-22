import type { CvData } from "@/lib/cvData.js";
import { escapeHtml } from "@/services/templates/shared.js";

type Skill = CvData["skills"][number];

export type SkillGroup = { category: string; skills: Skill[] };

/**
 * Group skills by category, preserving first-seen order of both categories and
 * the skills within them. Skills with an empty category share a single group
 * whose `category` is "".
 */
export function groupSkills(skills: Skill[]): SkillGroup[] {
  const groups: SkillGroup[] = [];
  const byCategory = new Map<string, SkillGroup>();
  for (const skill of skills) {
    const category = (skill.category ?? "").trim();
    let group = byCategory.get(category);
    if (!group) {
      group = { category, skills: [] };
      byCategory.set(category, group);
      groups.push(group);
    }
    group.skills.push(skill);
  }
  return groups;
}

/** True when at least one skill carries a non-empty category. */
export function hasSkillCategories(skills: Skill[]): boolean {
  return skills.some((skill) => (skill.category ?? "").trim().length > 0);
}

type RenderSkillGroupsOptions = {
  /** Tag for the wrapper around one group's skills (default "ul"). */
  groupTag?: string;
  /** Class for the skills wrapper (e.g. "inline-list"). */
  groupClass?: string;
  /** Class for the category heading (default "skill-cat", styled globally). */
  labelClass?: string;
  /** Class for the div wrapping [heading + skills] of a named category. */
  blockClass?: string;
  /** Separator between rendered skills within a group (default ""). Use ", "
   * for comma-joined inline skill lines. */
  separator?: string;
};

/**
 * Render skills grouped by category. Each non-empty category becomes a heading
 * followed by its skills; uncategorized skills render with no heading. When no
 * skill has a category the output is a single unlabelled wrapper, identical to
 * the flat list templates produced before categories existed. `renderSkill`
 * returns the HTML for one skill so each template keeps its own item styling.
 */
export function renderSkillGroups(
  skills: Skill[],
  renderSkill: (skill: Skill) => string,
  options: RenderSkillGroupsOptions = {}
): string {
  const groups = groupSkills(skills);
  if (groups.length === 0) return "";
  const groupTag = options.groupTag ?? "ul";
  const labelClass = options.labelClass ?? "skill-cat";
  const listClass = options.groupClass ? ` class="${options.groupClass}"` : "";
  const blockClass = ` class="${options.blockClass ?? "skill-group"}"`;
  const separator = options.separator ?? "";
  return groups
    .map((group) => {
      const inner = group.skills
        .map(renderSkill)
        .filter((html) => html.length > 0)
        .join(separator);
      if (!inner) return "";
      const list = `<${groupTag}${listClass}>${inner}</${groupTag}>`;
      if (!group.category) return list;
      const label = `<p class="${labelClass}">${escapeHtml(group.category)}</p>`;
      return `<div${blockClass}>${label}${list}</div>`;
    })
    .join("");
}

type RenderSkillGroupsInlineOptions = {
  /** Separator between skill names on a line (default " &middot; "). */
  separator?: string;
  /** Class for the wrapper <p> element. */
  className?: string;
  /** Class for the inline <strong> category label (default "font-bold"). */
  labelClass?: string;
};

/**
 * Render skills inline, matching SkillGroupsInline in frontend shared.tsx:
 * Format for categorized group: <p><strong>Category:</strong> Skill1 · Skill2 · Skill3</p>
 * Format for uncategorized group: <p>Skill1 · Skill2 · Skill3</p>
 */
export function renderSkillGroupsInline(
  skills: Skill[],
  options: RenderSkillGroupsInlineOptions = {}
): string {
  const groups = groupSkills(skills);
  if (groups.length === 0) return "";
  const separator = options.separator ?? " &middot; ";
  const labelAttr = options.labelClass
    ? ` class="${options.labelClass}"`
    : ' class="font-bold"';
  const lineAttr = options.className ? ` class="${options.className}"` : "";

  return groups
    .map((group) => {
      const names = group.skills
        .map((s) => escapeHtml(s.name.trim()))
        .filter((n) => n.length > 0)
        .join(separator);
      if (!names) return "";
      if (!group.category) return `<p${lineAttr}>${names}</p>`;
      return `<p${lineAttr}><strong${labelAttr}>${escapeHtml(
        group.category
      )}:</strong> ${names}</p>`;
    })
    .filter((line) => line.length > 0)
    .join("");
}
