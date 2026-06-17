import { normalizeCvLocale, type CvLocale } from "@/services/templates/i18n.js";

const instructions: Record<CvLocale, string> = {
  en: "Tulis seluruh hasil dalam bahasa Inggris yang natural dan profesional, apa pun bahasa input.",
  id: "Tulis seluruh hasil dalam bahasa Indonesia yang natural dan profesional, apa pun bahasa input.",
  zh: "用自然、专业的中文（普通话）撰写全部内容，无论输入是什么语言。",
};

export function languageInstruction(locale: unknown): string {
  return instructions[normalizeCvLocale(locale)];
}
