import type { CvData } from "@/lib/cvData.js";
import {
  documentShell,
  escapeHtml,
  formatDateRange,
  joinNonEmpty,
  renderDescription,
  renderSummary,
} from "@/services/templates/shared.js";
import { renderSkillGroups } from "@/services/templates/skills.js";
import {
  formatLinkText,
  linkIconSvg,
  resolveLinkIcon,
} from "@/services/templates/linkIcons.js";
import { photoToDataUrl } from "@/services/templates/photo.js";
import { getCvLabels } from "@/services/templates/i18n.js";

const GOLD = "#c9a84c";
const GOLD_DIM = "#c9a84c44";

const css = `
* { box-sizing: border-box; }
/* Sidebar colour on body background so page 2+ keeps the left fill */
body { font-family: Helvetica, Arial, sans-serif; color: #e2e8f0; font-size: 9pt; line-height: 1.6; margin: 0; background: linear-gradient(90deg, #150e28 0, #150e28 30%, #0f0c1a 30%, #0f0c1a 100%); }
.layout { display: grid; grid-template-columns: 30% 70%; min-height: 100vh; }
.sidebar { background: #150e28; padding: 26px 18px; }
.sidebar .photo-wrap { display: flex; justify-content: center; margin-bottom: 12px; }
.sidebar .photo { width: 88px; height: 88px; border-radius: 50%; object-fit: cover; border: 3px solid ${GOLD}; }
.sidebar h1 { font-size: 13.5pt; font-weight: 800; color: #fff; text-align: center; margin: 0 0 4px; }
.sidebar .role { font-size: 7.5pt; font-weight: 300; text-transform: uppercase; letter-spacing: 3px; color: ${GOLD}; text-align: center; margin: 0 0 14px; }
.s-h { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2.5px; color: ${GOLD}; border-bottom: 1px solid ${GOLD_DIM}; padding-bottom: 4px; margin: 14px 0 7px; }
.s-list { list-style: none; margin: 0; padding: 0; font-size: 8pt; color: #cbd5e1; }
.s-list li { margin-bottom: 5px; display: flex; align-items: center; gap: 6px; }
.s-list li .txt { word-break: break-word; }
.skill-item { display: flex; align-items: center; gap: 6px; font-size: 8pt; margin-bottom: 5px; color: #cbd5e1; }
.skill-dot { width: 5px; height: 5px; border-radius: 50%; background: ${GOLD}; flex-shrink: 0; }
.main { background: #0f0c1a; padding: 24px 22px; }
.sec-h { display: flex; align-items: center; gap: 10px; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2.5px; color: ${GOLD}; margin: 18px 0 8px; }
.sec-h::before { content: ""; display: block; width: 14px; height: 1px; background: ${GOLD}; }
.sec-h::after { content: ""; display: block; flex: 1; height: 1px; background: #2d2040; }
.entry { margin-bottom: 12px; }
.entry .top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.entry h3 { margin: 0; font-size: 9.5pt; font-weight: 700; color: #fff; }
.entry .date { font-size: 7.5pt; font-weight: 600; color: ${GOLD}; white-space: nowrap; flex-shrink: 0; }
.entry .meta { margin: 1px 0 2px; font-size: 8pt; color: #94a3b8; }
.entry ul { margin: 3px 0 0; padding-left: 16px; color: #cbd5e1; }
.entry p { margin: 0; color: #cbd5e1; }
.blk h3 { margin: 0 0 3px; font-size: 9pt; color: #fff; }
ul { list-style: disc; }
p { margin: 0; }
`;

function sideHeader(title: string): string {
  return `<div class="s-h">${escapeHtml(title)}</div>`;
}

function mainSection(title: string, content: string): string {
  if (!content) return "";
  return `<div><div class="sec-h">${escapeHtml(title)}</div>${content}</div>`;
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

function renderSidebar(data: CvData): string {
  const t = getCvLabels(data.language);
  const photoSrc = photoToDataUrl(data.personal.photoUrl);
  const photo = photoSrc
    ? `<div class="photo-wrap"><img class="photo" src="${escapeHtml(photoSrc)}" alt="" /></div>`
    : "";

  const role = data.personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(data.personal.jobTitle)}</p>`
    : "";

  const contactRows = [
    data.personal.email
      ? `<li>${linkIconSvg("mail", 12)}<span class="txt">${escapeHtml(data.personal.email)}</span></li>`
      : "",
    data.personal.phone
      ? `<li>${linkIconSvg("phone", 12)}<span class="txt">${escapeHtml(data.personal.phone)}</span></li>`
      : "",
    data.personal.address
      ? `<li>${linkIconSvg("location", 12)}<span class="txt">${escapeHtml(data.personal.address)}</span></li>`
      : "",
    ...data.personal.links.map((link) => {
      const txt = formatLinkText(link);
      return txt
        ? `<li>${linkIconSvg(resolveLinkIcon(link), 12)}<span class="txt">${escapeHtml(txt)}</span></li>`
        : "";
    }),
  ]
    .filter(Boolean)
    .join("");

  const contact = contactRows
    ? `${sideHeader(t.contact)}<ul class="s-list">${contactRows}</ul>`
    : "";

  const skillGroups = renderSkillGroups(
    data.skills,
    (s) =>
      s.name.trim()
        ? `<div class="skill-item"><span class="skill-dot"></span>${escapeHtml(s.name)}</div>`
        : "",
    { groupTag: "div" }
  );
  const skills = skillGroups ? `${sideHeader(t.skills)}${skillGroups}` : "";

  const languages = data.languages.filter((l) => l.name.trim()).length
    ? `${sideHeader(t.languages)}<ul class="s-list">${data.languages
        .filter((l) => l.name.trim())
        .map(
          (l) =>
            `<li><span class="txt">${escapeHtml(l.name)}${
              l.proficiency ? ` · ${escapeHtml(l.proficiency)}` : ""
            }</span></li>`
        )
        .join("")}</ul>`
    : "";

  const certs = data.certifications.filter((c) => c.name.trim()).length
    ? `${sideHeader(t.certifications)}<ul class="s-list">${data.certifications
        .filter((c) => c.name.trim())
        .map(
          (c) =>
            `<li><span class="txt"><strong style="color:#fff">${escapeHtml(
              c.name
            )}</strong>${c.issuer ? `<br/>${escapeHtml(c.issuer)}` : ""}</span></li>`
        )
        .join("")}</ul>`
    : "";

  return `<aside class="sidebar">${photo}<h1>${escapeHtml(
    data.personal.fullName
  )}</h1>${role}${contact}${skills}${languages}${certs}</aside>`;
}

export function renderMonarch(data: CvData): string {
  const t = getCvLabels(data.language);
  const summary = data.summary.trim()
    ? mainSection(t.summary, renderSummary(data.summary))
    : "";

  const experience = data.experience.length
    ? mainSection(
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
    ? mainSection(
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

  const projects = data.projects.length
    ? mainSection(
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

  const custom = data.customSections
    .map((cs) =>
      mainSection(
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

  const mainContent = `<div class="main">${summary}${experience}${education}${projects}${custom}</div>`;
  const body = `<div class="layout">${renderSidebar(data)}${mainContent}</div>`;
  return documentShell(data.personal.fullName, css, body, data.language);
}
