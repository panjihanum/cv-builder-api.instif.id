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
/* fullBleed: banner touches page edge; body margin 0 */
body { font-family: Helvetica, Arial, sans-serif; color: #262626; font-size: 9.5pt; line-height: 1.55; margin: 0; background: #ffffff; min-height: 100vh; }
.banner { background: linear-gradient(150deg, #9f1239 0%, #be123c 40%, #e11d48 80%, #fb7185 100%); padding: 30px 40px; display: flex; flex-direction: column; align-items: center; color: #fff; }
.photo { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 4px solid rgba(255,255,255,0.3); display: block; margin-bottom: 14px; }
.banner h1 { font-size: 22pt; font-weight: 800; letter-spacing: -0.4px; text-align: center; margin: 0 0 3px; }
.banner .role { margin: 0 0 10px; font-size: 8.5pt; font-weight: 300; letter-spacing: 1px; color: #fecdd3; }
.banner .contact { display: flex; flex-wrap: wrap; justify-content: center; gap: 5px 14px; font-size: 7.5pt; color: #fda4af; }
.banner .contact span { display: flex; align-items: center; gap: 4px; }
.content { padding: 6px 46px 32px; }
.sec-h { display: flex; align-items: center; gap: 8px; margin: 18px 0 8px; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2.5px; color: #9f1239; }
.sec-h::before { content: ""; display: inline-block; width: 6px; height: 6px; min-width: 6px; background: #e11d48; transform: rotate(45deg); }
.sec-h::after { content: ""; display: block; flex: 1; height: 1px; background: #fce7f3; }
.entry { margin-bottom: 12px; }
.entry.exp { border-left: 2px solid #fce7f3; padding-left: 11px; }
.entry .top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.entry h3 { margin: 0; font-size: 9.5pt; font-weight: 700; color: #111; }
.entry .date { font-size: 7.5pt; font-weight: 600; color: #be123c; white-space: nowrap; flex-shrink: 0; }
.entry .meta { margin: 1px 0 2px; font-size: 8pt; color: #6b7280; }
.entry ul { margin: 3px 0 0; padding-left: 16px; color: #404040; }
.entry p { margin: 0; color: #404040; }
.skill-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { background: #fff1f2; color: #be123c; font-size: 7.5pt; font-weight: 600; padding: 3px 10px; border-radius: 999px; }
.lang-row { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 8pt; }
.lang-name { font-weight: 600; }
.lang-prof { color: #9ca3af; }
.blk { margin-bottom: 6px; }
.blk h3 { margin: 0; font-size: 9pt; font-weight: 600; color: #111; }
ul { list-style: disc; }
p { margin: 0; }
`;

function section(title: string, content: string): string {
  if (!content) return "";
  return `<div><div class="sec-h">${escapeHtml(title)}</div>${content}</div>`;
}

function entry(
  date: string,
  heading: string,
  meta: string,
  body: string,
  extraClass = ""
): string {
  const cls = extraClass ? `entry ${extraClass}` : "entry";
  const dateLine = date ? `<span class="date">${date}</span>` : "";
  const metaLine = meta ? `<p class="meta">${meta}</p>` : "";
  return `<div class="${cls}"><div class="top"><h3>${heading}</h3>${dateLine}</div>${metaLine}${body}</div>`;
}

export function renderPortrait(data: CvData): string {
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

  const banner = `<div class="banner">
    ${photo}
    <h1>${escapeHtml(data.personal.fullName)}</h1>
    ${role}
    <div class="contact">${contactParts}</div>
  </div>`;

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
              ? `<span class="chip">${escapeHtml(s.name)}</span>`
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
                  ? ` <span class="lang-prof">(${escapeHtml(
                      l.proficiency
                    )})</span>`
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

  const body = `${banner}<div class="content">${summary}${experience}${education}${skills}${projects}${certifications}${languages}${custom}</div>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
