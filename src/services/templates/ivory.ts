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
import { renderSkillGroupsInline } from "@/services/templates/skills.js";

const css = `
* { box-sizing: border-box; }
body { font-family: Georgia, "Times New Roman", serif; color: #404040; font-size: 9.5pt; line-height: 1.7; margin: 0; background: #ffffff; min-height: 100vh; }
.page { padding: 40px 52px; }
header { text-align: center; }
h1 { font-size: 23pt; font-weight: 700; letter-spacing: 0; color: #111; margin: 0 0 4px; }
.role { margin: 0 0 10px; font-family: Helvetica, Arial, sans-serif; font-size: 8pt; font-weight: 300; text-transform: uppercase; letter-spacing: 5px; color: #9ca3af; }
.contact { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 16px; font-family: Helvetica, Arial, sans-serif; font-size: 7.5pt; color: #9ca3af; }
.contact span { display: flex; align-items: center; gap: 4px; }
.rule { height: 1px; background: #e5e7eb; margin: 16px 0; }
.sec-label { font-family: Helvetica, Arial, sans-serif; font-size: 7pt; font-weight: 600; text-transform: uppercase; letter-spacing: 4px; color: #9ca3af; margin-bottom: 10px; }
.entry { margin-bottom: 14px; }
.entry .top { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
.entry h3 { margin: 0; font-family: Helvetica, Arial, sans-serif; font-size: 9pt; font-weight: 600; color: #1a1a1a; }
.entry .date { font-family: Helvetica, Arial, sans-serif; font-size: 7.5pt; color: #9ca3af; white-space: nowrap; flex-shrink: 0; }
.entry .meta { margin: 1px 0 2px; font-size: 8.5pt; font-style: italic; color: #6b7280; }
.entry ul { margin: 4px 0 0; padding-left: 18px; font-size: 9pt; color: #525252; }
.entry p { margin: 0; font-size: 9pt; color: #525252; }
.skill-line { font-family: Helvetica, Arial, sans-serif; font-size: 9pt; color: #525252; }
ul { list-style: disc; }
p { margin: 0; }
`;

function divider(): string {
  return `<div class="rule"></div>`;
}

function section(title: string, content: string, addDivider = true): string {
  if (!content) return "";
  return `<div><p class="sec-label">${escapeHtml(title)}</p>${content}${addDivider ? divider() : ""}</div>`;
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

export function renderIvory(data: CvData): string {
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
    <div class="contact">${contactParts}</div>
  </header>
  ${divider()}`;

  const summary = data.summary.trim()
    ? section(t.summary, renderSummary(data.summary))
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
              renderDescription(item.description)
            )
          )
          .join("")
      )
    : "";

  const skills = data.skills.filter((s) => s.name.trim()).length
    ? section(t.skills, renderSkillGroupsInline(data.skills))
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
        `<ul>${data.certifications
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
          .join(" &middot; ")}</p>`,
        false
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
