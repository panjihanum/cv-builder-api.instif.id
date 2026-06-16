import { Hono } from "hono";
import { z } from "zod";
import { cvDataSchema } from "@/lib/cvData.js";
import { validate } from "@/lib/validation.js";
import { requireAuth, type AuthEnv } from "@/middleware/requireAuth.js";
import * as cvService from "@/services/cv.service.js";

const createCvSchema = z.object({
  title: z.string().min(1).optional(),
  templateId: z.string().min(1).optional(),
  data: cvDataSchema.optional(),
});

const updateCvSchema = z.object({
  title: z.string().min(1).optional(),
  templateId: z.string().min(1).optional(),
  data: cvDataSchema.optional(),
});

export const cvRoutes = new Hono<AuthEnv>();

cvRoutes.use("*", requireAuth);

cvRoutes.get("/", async (c) => {
  const items = await cvService.listCvs(c.get("user").sub);
  return c.json({ items });
});

cvRoutes.post("/", validate("json", createCvSchema), async (c) => {
  const { title, templateId, data } = c.req.valid("json");
  const cv = await cvService.createCv(
    c.get("user").sub,
    title,
    templateId,
    data
  );
  return c.json({ cv });
});

cvRoutes.get("/:id", async (c) => {
  const cv = await cvService.getOwnedCv(c.get("user").sub, c.req.param("id"));
  return c.json({ cv });
});

cvRoutes.patch("/:id", validate("json", updateCvSchema), async (c) => {
  const cv = await cvService.updateCv(
    c.get("user").sub,
    c.req.param("id"),
    c.req.valid("json")
  );
  return c.json({ cv });
});

cvRoutes.delete("/:id", async (c) => {
  await cvService.deleteCv(c.get("user").sub, c.req.param("id"));
  return c.json({ ok: true });
});
