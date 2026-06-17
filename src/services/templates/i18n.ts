export const cvLocales = ["en", "id", "zh"] as const;

export type CvLocale = (typeof cvLocales)[number];

export const defaultCvLocale: CvLocale = "en";

export function normalizeCvLocale(value: unknown): CvLocale {
  return cvLocales.includes(value as CvLocale)
    ? (value as CvLocale)
    : defaultCvLocale;
}

const monthNames: Record<CvLocale, string[]> = {
  en: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  id: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ],
  zh: [
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ],
};

export function formatCvMonth(value: string, locale: CvLocale): string {
  const match = value.match(/^(\d{4})-(\d{2})/);
  if (!match) return value;
  const year = match[1];
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return value;
  if (locale === "zh") {
    return `${year}年${monthNames.zh[monthIndex]}`;
  }
  return `${monthNames[locale][monthIndex]} ${year}`;
}

const presentWords: Record<CvLocale, string> = {
  en: "Present",
  id: "Sekarang",
  zh: "至今",
};

export function getPresentWord(locale: CvLocale): string {
  return presentWords[locale] ?? presentWords[defaultCvLocale];
}

export type CvSectionLabels = {
  summary: string;
  experience: string;
  education: string;
  skills: string;
  projects: string;
  certifications: string;
  languages: string;
  contact: string;
  gpa: string;
  other: string;
};

const sectionLabels: Record<CvLocale, CvSectionLabels> = {
  en: {
    summary: "Summary",
    experience: "Work Experience",
    education: "Education",
    skills: "Skills",
    projects: "Projects",
    certifications: "Certifications",
    languages: "Languages",
    contact: "Contact",
    gpa: "GPA",
    other: "Other",
  },
  id: {
    summary: "Ringkasan",
    experience: "Pengalaman Kerja",
    education: "Pendidikan",
    skills: "Keahlian",
    projects: "Proyek",
    certifications: "Sertifikasi",
    languages: "Bahasa",
    contact: "Kontak",
    gpa: "IPK",
    other: "Lainnya",
  },
  zh: {
    summary: "个人简介",
    experience: "工作经历",
    education: "教育背景",
    skills: "专业技能",
    projects: "项目经历",
    certifications: "证书",
    languages: "语言能力",
    contact: "联系方式",
    gpa: "绩点",
    other: "其他",
  },
};

export function getCvLabels(locale: CvLocale): CvSectionLabels {
  return sectionLabels[locale] ?? sectionLabels[defaultCvLocale];
}
