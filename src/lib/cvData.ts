import { z } from "zod";

const linkSchema = z.object({
  id: z.string().default(""),
  label: z.string().default(""),
  url: z.string().default(""),
});

const personalSchema = z.object({
  fullName: z.string().default(""),
  jobTitle: z.string().default(""),
  email: z.string().default(""),
  phone: z.string().default(""),
  address: z.string().default(""),
  photoUrl: z.string().default(""),
  links: z.array(linkSchema).default([]),
});

const experienceSchema = z.object({
  id: z.string().default(""),
  company: z.string().default(""),
  position: z.string().default(""),
  location: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  current: z.boolean().default(false),
  description: z.string().default(""),
});

const educationSchema = z.object({
  id: z.string().default(""),
  institution: z.string().default(""),
  degree: z.string().default(""),
  field: z.string().default(""),
  startDate: z.string().default(""),
  endDate: z.string().default(""),
  gpa: z.string().default(""),
  description: z.string().default(""),
});

const skillSchema = z.object({
  id: z.string().default(""),
  name: z.string().default(""),
  level: z.number().min(1).max(5).default(3),
});

const projectSchema = z.object({
  id: z.string().default(""),
  name: z.string().default(""),
  url: z.string().default(""),
  description: z.string().default(""),
});

const certificationSchema = z.object({
  id: z.string().default(""),
  name: z.string().default(""),
  issuer: z.string().default(""),
  date: z.string().default(""),
});

const languageSchema = z.object({
  id: z.string().default(""),
  name: z.string().default(""),
  proficiency: z.string().default(""),
});

const customSectionItemSchema = z.object({
  id: z.string().default(""),
  heading: z.string().default(""),
  body: z.string().default(""),
});

const customSectionSchema = z.object({
  id: z.string().default(""),
  title: z.string().default(""),
  items: z.array(customSectionItemSchema).default([]),
});

export const cvDataSchema = z.object({
  personal: personalSchema.prefault({}),
  summary: z.string().default(""),
  experience: z.array(experienceSchema).default([]),
  education: z.array(educationSchema).default([]),
  skills: z.array(skillSchema).default([]),
  projects: z.array(projectSchema).default([]),
  certifications: z.array(certificationSchema).default([]),
  languages: z.array(languageSchema).default([]),
  customSections: z.array(customSectionSchema).default([]),
});

export type CvData = z.infer<typeof cvDataSchema>;

export function createEmptyCvData(): CvData {
  return cvDataSchema.parse({});
}
