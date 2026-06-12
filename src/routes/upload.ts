import { Hono } from "hono";
import { assertUploadedFile, saveUploadedFile } from "@/lib/uploads.js";
import { requireAuth, type AuthEnv } from "@/middleware/requireAuth.js";

const photoFileRule = {
  mimeTypes: ["image/jpeg", "image/png"],
  extensions: [".jpg", ".jpeg", ".png"],
  label: "jpg atau png",
  maxBytes: 2 * 1024 * 1024,
};

export const uploadRoutes = new Hono<AuthEnv>();

uploadRoutes.post("/photo", requireAuth, async (c) => {
  const body = await c.req.parseBody();
  const file = assertUploadedFile(body.file, photoFileRule);
  const url = await saveUploadedFile(file);
  return c.json({ url });
});
