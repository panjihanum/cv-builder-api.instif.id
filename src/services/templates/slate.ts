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
  linkIconSvg,
  resolveLinkIcon,
} from "@/services/templates/linkIcons.js";
import { photoToDataUrl } from "@/services/templates/photo.js";
import { getCvLabels } from "@/services/templates/i18n.js";
import { renderSkillGroups } from "@/services/templates/skills.js";

const css = `
* { box-sizing: border-box; }
body { font-family: Helvetica, Arial, sans-serif; color: #262626; font-size: 9.5pt; line-height: 1.55; margin: 0; background: #ffffff; min-height: 100vh; }
.page { padding: 36px 46px; }
header { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
header .info { flex: 1; }
h1 { font-size: 22pt; font-weight: 800; letter-spacing: -0.5px; color: #0a0a0a; margin: 0 0 2px; }
.role { margin: 0 0 10px; font-size: 9.5pt; font-weight: 600; color: #2563eb; }
.contact { display: flex; flex-wrap: wrap; gap: 6px 14px; font-size: 7.5pt; color: #6b7280; }
.contact span { display: flex; align-items: center; gap: 4px; }
.photo { width: 78px; height: 78px; border-radius: 50%; object-fit: cover; border: 2px solid #dbeafe; flex-shrink: 0; }
.divider { height: 2px; background: linear-gradient(90deg, #2563eb, #bfdbfe); margin: 14px 0 0; }
.sec-h { margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #2563eb; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2.5px; color: #1d4ed8; }
.entry { margin-bottom: 12px; }
.entry .top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.entry h3 { margin: 0; font-size: 9.5pt; font-weight: 700; color: #0a0a0a; }
.entry .date { font-size: 7.5pt; font-weight: 600; color: #2563eb; white-space: nowrap; flex-shrink: 0; }
.entry .meta { margin: 1px 0 2px; font-size: 8pt; font-weight: 500; color: #6b7280; }
.entry ul { margin: 3px 0 0; padding-left: 16px; color: #404040; }
.entry p { margin: 0; color: #404040; }
.skill-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { background: #eff6ff; color: #1d4ed8; font-size: 7.5pt; font-weight: 600; padding: 3px 9px; border-radius: 4px; }
.lang-list, .cert-list { font-size: 8.5pt; color: #404040; }
.lang-list li, .cert-list li { margin-bottom: 4px; }
ul { list-style: disc; }
p { margin: 0; }
`;

function section(title: string, content: string): string {
  if (!content) return "";
  return `<div><p class="sec-h">${escapeHtml(title)}</p>${content}</div>`;
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

export function renderSlate(data: CvData): string {
  const t = getCvLabels(data.language);
  const photoSrc = photoToDataUrl(data.personal.photoUrl);
  const photo = photoSrc
    ? `<img class="photo" src="${escapeHtml(photoSrc)}" alt="" />`
    : "";

  const contactParts = [
    data.personal.email
      ? `<span>${linkIconSvg("mail", 11)}${escapeHtml(data.personal.email)}</span>`
      : "",
    data.personal.phone
      ? `<span>${linkIconSvg("phone", 11)}${escapeHtml(data.personal.phone)}</span>`
      : "",
    data.personal.address
      ? `<span>${linkIconSvg("location", 11)}${escapeHtml(data.personal.address)}</span>`
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
    <div class="info">
      <h1>${escapeHtml(data.personal.fullName)}</h1>
      ${role}
      <div class="contact">${contactParts}</div>
    </div>
    ${photo}
  </header>
  <div class="divider"></div>`;

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
          (skill) =>
            skill.name.trim()
              ? `<span class="chip">${escapeHtml(skill.name)}</span>`
              : "",
          { groupTag: "div", groupClass: "skill-chips" }
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
        `<ul class="lang-list">${data.languages
          .filter((l) => l.name.trim())
          .map(
            (l) =>
              `<li><strong>${escapeHtml(l.name)}</strong>${
                l.proficiency ? ` (${escapeHtml(l.proficiency)})` : ""
              }</li>`
          )
          .join("")}</ul>`
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
