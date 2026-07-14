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
import { getCvLabels } from "@/services/templates/i18n.js";
import { photoToDataUrl } from "@/services/templates/photo.js";
import { renderSkillGroups } from "@/services/templates/skills.js";

const css = `
* { box-sizing: border-box; }
body { font-family: Helvetica, Arial, sans-serif; color: #262626; font-size: 9.5pt; line-height: 1.55; margin: 0; background: #ffffff; min-height: 100vh; }
.page { padding: 30px 38px; }
header { display: flex; align-items: center; gap: 16px; margin-bottom: 4px; }
.photo { width: 74px; height: 74px; border-radius: 8px; object-fit: cover; flex-shrink: 0; }
header .info { flex: 1; }
h1 { font-size: 21pt; font-weight: 800; letter-spacing: -0.4px; color: #0a0a0a; margin: 0 0 2px; }
.role { margin: 0 0 8px; font-size: 9pt; font-weight: 500; color: #737373; }
.contact { display: flex; flex-wrap: wrap; gap: 5px 12px; font-size: 7.5pt; color: #737373; }
.contact span { display: flex; align-items: center; gap: 4px; }
.label { display: inline-block; background: #171717; color: #fff; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; padding: 3px 10px; border-radius: 4px; margin: 16px 0 9px; }
.entry { margin-bottom: 12px; }
.entry.exp { border-left: 4px solid #e5e7eb; padding-left: 12px; }
.entry .top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.entry h3 { margin: 0; font-size: 9.5pt; font-weight: 700; color: #0a0a0a; }
.entry .date { font-size: 7.5pt; color: #a3a3a3; white-space: nowrap; flex-shrink: 0; }
.entry .meta { margin: 1px 0 2px; font-size: 8pt; font-weight: 500; color: #737373; }
.entry ul { margin: 3px 0 0; padding-left: 16px; font-size: 9pt; color: #404040; }
.entry p { margin: 0; font-size: 9pt; color: #404040; }
.skill-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5px 18px; }
.si { display: flex; align-items: center; gap: 5px; font-size: 8.5pt; color: #404040; }
.si .dot { width: 5px; height: 5px; border-radius: 50%; background: #a3a3a3; flex-shrink: 0; }
.blk { margin-bottom: 6px; }
.blk h3 { margin: 0; font-size: 9pt; font-weight: 600; color: #0a0a0a; }
.lang-row { display: flex; flex-wrap: wrap; gap: 12px; font-size: 8.5pt; }
.lang-row .lang-name { font-weight: 500; }
.lang-row .lang-prof { color: #a3a3a3; }
ul { list-style: disc; }
p { margin: 0; }
`;

function section(title: string, content: string): string {
  if (!content) return "";
  return `<div><span class="label">${escapeHtml(title)}</span>${content}</div>`;
}

function entry(
  date: string,
  heading: string,
  meta: string,
  body: string,
  cls = ""
): string {
  const dateLine = date ? `<span class="date">${date}</span>` : "";
  const metaLine = meta ? `<p class="meta">${meta}</p>` : "";
  const entryClass = cls ? `entry ${cls}` : "entry";
  return `<div class="${entryClass}"><div class="top"><h3>${heading}</h3>${dateLine}</div>${metaLine}${body}</div>`;
}

export function renderCanvas(data: CvData): string {
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
    ${photo}
    <div class="info">
      <h1>${escapeHtml(data.personal.fullName)}</h1>
      ${role}
      <div class="contact">${contactParts}</div>
    </div>
  </header>`;

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
              renderDescription(item.description),
              "exp"
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
    ? section(
        t.skills,
        renderSkillGroups(
          data.skills,
          (s) =>
            s.name.trim()
              ? `<div class="si"><span class="dot"></span>${escapeHtml(s.name)}</div>`
              : "",
          { groupTag: "div", groupClass: "skill-grid" }
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
        `<div class="lang-row">${data.languages
          .filter((l) => l.name.trim())
          .map(
            (l) =>
              `<span><span class="lang-name">${escapeHtml(l.name)}</span>${
                l.proficiency
                  ? ` <span class="lang-prof">(${escapeHtml(l.proficiency)})</span>`
                  : ""
              }</span>`
          )
          .join("")}</div>`
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
