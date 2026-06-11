import { db } from "@/lib/db.js";
import { HttpError } from "@/lib/httpError.js";
import { createEmptyCvData, type CvData } from "@/lib/cvData.js";

const cvSelect = {
  id: true,
  title: true,
  templateId: true,
  data: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface UpdateCvInput {
  title?: string;
  templateId?: string;
  data?: CvData;
}

export async function listCvs(userId: string) {
  return db.cv.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: cvSelect,
  });
}

export async function createCv(userId: string, title?: string) {
  return db.cv.create({
    data: {
      userId,
      ...(title ? { title } : {}),
      data: createEmptyCvData(),
    },
    select: cvSelect,
  });
}

export async function getOwnedCv(userId: string, cvId: string) {
  const cv = await db.cv.findFirst({
    where: { id: cvId, userId },
    select: cvSelect,
  });
  if (!cv) {
    throw new HttpError(404, "CV tidak ditemukan");
  }
  return cv;
}

export async function updateCv(
  userId: string,
  cvId: string,
  input: UpdateCvInput
) {
  await getOwnedCv(userId, cvId);
  return db.cv.update({
    where: { id: cvId },
    data: input,
    select: cvSelect,
  });
}

export async function deleteCv(userId: string, cvId: string) {
  await getOwnedCv(userId, cvId);
  await db.cv.delete({ where: { id: cvId } });
}
