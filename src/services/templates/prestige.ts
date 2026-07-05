import type { CvData } from "@/lib/cvData.js";
import {
  documentShell,
  escapeHtml,
  formatDateRange,
  joinNonEmpty,
  renderDescription,
  renderSummary,
} from "@/services/templates/shared.js";
import {
  formatLinkText,
  resolveLinkIcon,
  linkIconSvg,
} from "@/services/templates/linkIcons.js";
import { getCvLabels } from "@/services/templates/i18n.js";
import { renderSkillGroups } from "@/services/templates/skills.js";

const css = `
* { box-sizing: border-box; }
body { font-family: Georgia, "Times New Roman", serif; color: #374151; font-size: 9.5pt; line-height: 1.65; margin: 0; background: #ffffff; min-height: 100vh; }
.page { padding: 36px 52px; }
header { text-align: center; margin-bottom: 4px; }
h1 { font-size: 24pt; font-weight: 700; letter-spacing: -0.3px; color: #0a0a0a; margin: 0 0 4px; }
.role { font-family: Helvetica, Arial, sans-serif; font-size: 7.5pt; font-weight: 300; text-transform: uppercase; letter-spacing: 6px; color: #9ca3af; margin: 0 0 8px; }
.gold-rule { height: 1px; background: linear-gradient(90deg, transparent, #d4a017, transparent); margin: 6px auto 8px; max-width: 60%; }
.contact { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 14px; font-family: Helvetica, Arial, sans-serif; font-size: 7.5pt; color: #9ca3af; }
.contact span { display: flex; align-items: center; gap: 4px; }
.sec-h { display: flex; align-items: center; gap: 10px; margin: 18px 0 8px; font-family: Helvetica, Arial, sans-serif; font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: 4px; color: #6b7280; }
.sec-h span { display: block; flex: 1; height: 1px; background: #e9c46a55; }
.entry { margin-bottom: 14px; }
.entry .top { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.entry h3 { margin: 0; font-family: Helvetica, Arial, sans-serif; font-size: 9.5pt; font-weight: 700; color: #111827; }
.entry .date { font-family: Helvetica, Arial, sans-serif; font-size: 7.5pt; color: #9ca3af; white-space: nowrap; flex-shrink: 0; }
.entry .meta { margin: 1px 0 2px; font-size: 8.5pt; font-style: italic; color: #6b7280; }
.entry ul { margin: 4px 0 0; padding-left: 18px; font-size: 9pt; color: #4b5563; }
.entry p { margin: 0; font-size: 9pt; color: #4b5563; }
.summary { text-align: center; font-size: 9pt; color: #6b7280; }
.skill-line { text-align: center; font-family: Helvetica, Arial, sans-serif; font-size: 9pt; color: #4b5563; }
.cert-list { list-style: none; padding: 0; margin: 0; text-align: center; font-family: Helvetica, Arial, sans-serif; font-size: 8.5pt; color: #4b5563; }
.cert-list li { margin-bottom: 4px; }
ul { list-style: disc; }
p { margin: 0; }
`;

function section(title: string, content: string): string {
  if (!content) return "";
  return `<div><div class="sec-h"><span></span>${escapeHtml(title)}<span></span></div>${content}</div>`;
}

function entry(
  date: string,
  heading: string,
  meta: string,
  body: string
): string {
  const dateLine = date ? `<span class="date">${date}</span>` : "";
  const metaLine = meta ? `<p class="meta">${meta}</p>` : "";
  return `<div class="entry"><div class="top"><h3>${heading}</h3>${dateLine}</div>${metaLine}${body}</div>`;
}

export function renderPrestige(data: CvData): string {
  const t = getCvLabels(data.language);
  const contactParts = [
    data.personal.email
      ? `<span>${escapeHtml(data.personal.email)}</span>`
      : "",
    data.personal.phone
      ? `<span>${escapeHtml(data.personal.phone)}</span>`
      : "",
    data.personal.address
      ? `<span>${escapeHtml(data.personal.address)}</span>`
      : "",
    ...data.personal.links.map((link) => {
      const txt = formatLinkText(link);
      return txt
        ? `<span>${linkIconSvg(resolveLinkIcon(link), 11)}${escapeHtml(txt)}</span>`
        : "";
    }),
  ]
    .filter(Boolean)
    .join("");

  const role = data.personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(data.personal.jobTitle)}</p>`
    : "";

  const headerHtml = `<header>
    <h1>${escapeHtml(data.personal.fullName)}</h1>
    ${role}
    <div class="gold-rule"></div>
    <div class="contact">${contactParts}</div>
  </header>`;

  const summary = data.summary.trim()
    ? section(
        t.summary,
        `<div class="summary">${renderSummary(data.summary)}</div>`
      )
    : "";

  const experience = data.experience.length
    ? section(
        t.experience,
        data.experience
          .map((item) =>
            entry(
              escapeHtml(
                formatDateRange(
                  item.startDate,
                  item.endDate,
                  item.current,
                  data.language
                )
              ),
              escapeHtml(item.position),
              joinNonEmpty(
                [item.company, item.location].map(escapeHtml),
                " · "
              ),
              renderDescription(item.description)
            )
          )
          .join("")
      )
    : "";

  const education = data.education.length
    ? section(
        t.education,
        data.education
          .map((item) =>
            entry(
              escapeHtml(
                formatDateRange(
                  item.startDate,
                  item.endDate,
                  false,
                  data.language
                )
              ),
              escapeHtml(item.institution),
              joinNonEmpty(
                [
                  [item.degree, item.field]
                    .filter(Boolean)
                    .map(escapeHtml)
                    .join(" "),
                  item.gpa.trim() ? `${t.gpa} ${escapeHtml(item.gpa)}` : "",
                ],
                " · "
              ),
              ""
            )
          )
          .join("")
      )
    : "";

  const skills = data.skills.filter((s) => s.name.trim()).length
    ? section(
        t.skills,
        renderSkillGroups(
          data.skills,
          (skill) => (skill.name.trim() ? escapeHtml(skill.name) : ""),
          { groupTag: "p", groupClass: "skill-line", separator: " &middot; " }
        )
      )
    : "";

  const projects = data.projects.length
    ? section(
        t.projects,
        data.projects
          .map((p) =>
            entry(
              "",
              joinNonEmpty([p.name, p.url].map(escapeHtml), " &mdash; "),
              "",
              renderDescription(p.description)
            )
          )
          .join("")
      )
    : "";

  const certifications = data.certifications.length
    ? section(
        t.certifications,
        `<ul class="cert-list">${data.certifications
          .map(
            (c) =>
              `<li>${joinNonEmpty(
                [c.name, c.issuer, c.date].map(escapeHtml),
                " &middot; "
              )}</li>`
          )
          .join("")}</ul>`
      )
    : "";

  const languages = data.languages.filter((l) => l.name.trim()).length
    ? section(
        t.languages,
        `<p class="skill-line">${data.languages
          .filter((l) => l.name.trim())
          .map(
            (l) =>
              `${escapeHtml(l.name)}${l.proficiency ? ` (${escapeHtml(l.proficiency)})` : ""}`
          )
          .join(" &middot; ")}</p>`
      )
    : "";

  const custom = data.customSections
    .map((cs) =>
      section(
        cs.title || t.other,
        cs.items
          .map((item) =>
            entry(
              "",
              escapeHtml(item.heading),
              "",
              renderDescription(item.body)
            )
          )
          .join("")
      )
    )
    .join("");

  const body = `<div class="page">${headerHtml}${summary}${experience}${education}${skills}${projects}${certifications}${languages}${custom}</div>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
