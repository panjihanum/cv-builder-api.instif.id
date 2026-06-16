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

const css = `
* { box-sizing: border-box; }
/* Sidebar colour extended across page breaks via body background */
body { font-family: Helvetica, Arial, sans-serif; color: #1a2e1a; font-size: 9.5pt; line-height: 1.55; margin: 0; background: linear-gradient(90deg, #14532d 0, #14532d 30%, #ffffff 30%, #ffffff 100%); }
.layout { display: grid; grid-template-columns: 30% 70%; min-height: 100vh; }
.sidebar { background: linear-gradient(180deg, #14532d 0%, #166534 60%, #15803d 100%); color: #ffffff; padding: 28px 18px; }
.sidebar .profile { text-align: center; margin-bottom: 16px; }
.sidebar .photo { width: 94px; height: 94px; border-radius: 50%; object-fit: cover; display: block; margin: 0 auto 12px; border: 4px solid rgba(255,255,255,0.25); }
.sidebar h1 { font-size: 14pt; font-weight: 800; margin: 0 0 3px; line-height: 1.2; color: #fff; }
.sidebar .role { margin: 0; font-size: 8.5pt; font-weight: 500; color: #a7f3d0; }
.sidebar h2 { font-size: 8pt; text-transform: uppercase; letter-spacing: 2px; margin: 16px 0 6px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.15); color: #6ee7b7; font-weight: 700; }
.sidebar h2:first-of-type { margin-top: 0; }
.sidebar ul { list-style: none; margin: 0; padding: 0; font-size: 8.5pt; }
.sidebar li { margin-bottom: 5px; display: flex; align-items: flex-start; gap: 5px; word-break: break-word; }
.sidebar li .dot { width: 6px; height: 6px; min-width: 6px; border-radius: 50%; background: #34d399; margin-top: 4px; }
.cert-name { font-weight: 600; }
.cert-issuer { color: #a7f3d0; font-size: 8pt; }
.main { background: #ffffff; padding: 28px 26px; }
.main h2 { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2.5px; color: #14532d; margin: 18px 0 8px 0; }
.main h2::after { content: ""; display: block; width: 28px; height: 2px; background: #16a34a; border-radius: 99px; margin-top: 3px; }
.entry { margin-bottom: 12px; }
.entry .top { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.entry h3 { margin: 0; font-size: 9.5pt; font-weight: 700; color: #0a0a0a; }
.entry .date { font-size: 7.5pt; font-weight: 600; color: #15803d; white-space: nowrap; flex-shrink: 0; }
.entry .meta { margin: 1px 0 2px; font-size: 8pt; color: #6b7280; }
.entry ul { margin: 3px 0 0; padding-left: 16px; color: #404040; }
.entry p { margin: 0; color: #404040; }
.blk { margin-bottom: 6px; }
.blk h3 { margin: 0; font-size: 9pt; font-weight: 600; color: #0a0a0a; }
ul { list-style: disc; }
p { margin: 0; }
`;

function mainSection(title: string, content: string): string {
  if (!content) return "";
  return `<div><h2>${escapeHtml(title)}</h2>${content}</div>`;
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

export function renderSilhouette(data: CvData): string {
  const photoSrc = photoToDataUrl(data.personal.photoUrl);
  const photo = photoSrc
    ? `<img class="photo" src="${escapeHtml(photoSrc)}" alt="" />`
    : "";

  const role = data.personal.jobTitle.trim()
    ? `<p class="role">${escapeHtml(data.personal.jobTitle)}</p>`
    : "";

  const contactItems = [
    data.personal.email
      ? `<li>${linkIconSvg("mail", 11)}<span style="word-break:break-all">${escapeHtml(data.personal.email)}</span></li>`
      : "",
    data.personal.phone
      ? `<li>${linkIconSvg("phone", 11)}${escapeHtml(data.personal.phone)}</li>`
      : "",
    data.personal.address
      ? `<li>${linkIconSvg("location", 11)}${escapeHtml(data.personal.address)}</li>`
      : "",
    ...data.personal.links.map((link) => {
      const txt = formatLinkText(link);
      return txt
        ? `<li>${linkIconSvg(resolveLinkIcon(link), 11)}<span style="word-break:break-all">${escapeHtml(txt)}</span></li>`
        : "";
    }),
  ]
    .filter(Boolean)
    .join("");

  const skillItems = data.skills
    .filter((s) => s.name.trim())
    .map((s) => `<li><span class="dot"></span>${escapeHtml(s.name)}</li>`)
    .join("");

  const langItems = data.languages
    .filter((l) => l.name.trim())
    .map(
      (l) =>
        `<li><span class="dot"></span>${escapeHtml(l.name)}${
          l.proficiency ? ` (${escapeHtml(l.proficiency)})` : ""
        }</li>`
    )
    .join("");

  const certItems = data.certifications
    .map(
      (c) =>
        `<li><div><p class="cert-name">${escapeHtml(c.name)}</p>${
          c.issuer ? `<p class="cert-issuer">${escapeHtml(c.issuer)}</p>` : ""
        }</div></li>`
    )
    .join("");

  const sidebar = `<div class="sidebar">
    <div class="profile">
      ${photo}
      <h1>${escapeHtml(data.personal.fullName)}</h1>
      ${role}
    </div>
    ${contactItems ? `<h2>Kontak</h2><ul>${contactItems}</ul>` : ""}
    ${skillItems ? `<h2>Keahlian</h2><ul>${skillItems}</ul>` : ""}
    ${langItems ? `<h2>Bahasa</h2><ul>${langItems}</ul>` : ""}
    ${certItems ? `<h2>Sertifikasi</h2><ul>${certItems}</ul>` : ""}
  </div>`;

  const summary = data.summary.trim()
    ? mainSection("Ringkasan", renderSummary(data.summary))
    : "";

  const experience = data.experience.length
    ? mainSection(
        "Pengalaman Kerja",
        data.experience
          .map((item) =>
            entry(
              escapeHtml(
                formatDateRange(item.startDate, item.endDate, item.current)
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
        "Pendidikan",
        data.education
          .map((item) =>
            entry(
              escapeHtml(formatDateRange(item.startDate, item.endDate, false)),
              escapeHtml(item.institution),
              joinNonEmpty(
                [
                  [item.degree, item.field]
                    .filter(Boolean)
                    .map(escapeHtml)
                    .join(" "),
                  item.gpa.trim() ? `IPK ${escapeHtml(item.gpa)}` : "",
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
        "Proyek",
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
        cs.title || "Lainnya",
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

  const main = `<div class="main">${summary}${experience}${education}${projects}${custom}</div>`;
  const body = `<div class="layout">${sidebar}${main}</div>`;
  return documentShell(data.personal.fullName, css, body);
}
