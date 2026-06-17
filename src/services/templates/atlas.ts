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

const css = `
* { box-sizing: border-box; }
/* Sidebar colour on body bg so page 2+ keeps the left fill */
body { font-family: Helvetica, Arial, sans-serif; color: #1e293b; font-size: 9.5pt; line-height: 1.55; margin: 0; background: linear-gradient(90deg, #0f2744 0, #0f2744 30%, #ffffff 30%, #ffffff 100%); }
.layout { display: grid; grid-template-columns: 30% 70%; min-height: 100vh; }
.sidebar { background: linear-gradient(180deg, #1e3a5f 0%, #0f2744 100%); color: #cbd5e1; padding: 26px 18px; }
.sidebar .photo { width: 90px; height: 90px; border-radius: 50%; object-fit: cover; display: block; margin: 0 auto 12px; border: 4px solid rgba(255,255,255,0.18); }
.sidebar h1 { font-size: 14pt; font-weight: 800; color: #fff; margin: 0 0 3px; text-align: center; }
.sidebar .role { font-size: 8pt; font-weight: 300; color: #94a3b8; text-align: center; margin: 0 0 14px; }
.s-h { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #94a3b8; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 4px; margin: 14px 0 7px; }
.s-list { list-style: none; margin: 0; padding: 0; font-size: 8.5pt; color: #cbd5e1; }
.s-list li { margin-bottom: 5px; display: flex; align-items: center; gap: 6px; }
.s-list li .txt { word-break: break-word; }
.si { display: flex; align-items: center; gap: 6px; font-size: 8.5pt; margin-bottom: 5px; }
.si .dot { width: 6px; height: 6px; border-radius: 50%; background: #38bdf8; flex-shrink: 0; }
.main { padding: 24px 22px; background: #fff; }
.main-head { border-bottom: 2px solid #0f2744; padding-bottom: 10px; margin-bottom: 4px; }
.sec-h { display: flex; align-items: center; gap: 8px; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #1e3a5f; margin: 16px 0 8px; }
.sec-h::after { content: ""; display: block; flex: 1; height: 1px; background: #e2e8f0; }
.entry { margin-bottom: 11px; }
.entry .top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.entry h3 { margin: 0; font-size: 9.5pt; font-weight: 700; color: #0f172a; }
.entry .date { font-size: 7.5pt; font-weight: 600; color: #0369a1; white-space: nowrap; flex-shrink: 0; }
.entry .meta { margin: 1px 0 2px; font-size: 8pt; font-weight: 500; color: #64748b; }
.entry ul { margin: 3px 0 0; padding-left: 16px; color: #475569; }
.entry p { margin: 0; color: #475569; }
.blk h3 { margin: 0 0 3px; font-size: 9pt; color: #0f172a; }
ul { list-style: disc; }
p { margin: 0; }
`;

function sideHeader(title: string): string {
  return `<div class="s-h">${escapeHtml(title)}</div>`;
}

function mainHeader(title: string): string {
  return `<div class="sec-h">${escapeHtml(title)}</div>`;
}

function mainSection(title: string, content: string): string {
  if (!content) return "";
  return `<div>${mainHeader(title)}${content}</div>`;
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
    ? `<img class="photo" src="${escapeHtml(photoSrc)}" alt="" />`
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

  const skills = data.skills.filter((s) => s.name.trim()).length
    ? `${sideHeader(t.skills)}${data.skills
        .filter((s) => s.name.trim())
        .map(
          (s) =>
            `<div class="si"><span class="dot"></span>${escapeHtml(s.name)}</div>`
        )
        .join("")}`
    : "";

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

export function renderAtlas(data: CvData): string {
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
