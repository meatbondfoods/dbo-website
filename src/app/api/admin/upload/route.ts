import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { requireAdminApi } from "@/lib/adminAuth";
import { apiError, json } from "@/lib/http";
import { MAX_IMAGE_BYTES, validateImage } from "@/lib/media";

/**
 * Image upload for site content (hero, banners, logo, social preview). Editors and owners only.
 * DEVELOPMENT storage: writes to public/uploads (git-ignored, so not deployed). Production stores images in the
 * Supabase Storage bucket "site-media" (migration 106) once the approved admin login exists.
 * The browser's file name and MIME type are ignored: the type comes from the file's own bytes, and the stored
 * name is random, so a client cannot choose a path or smuggle an executable/SVG file.
 */
export async function POST(req: Request) {
  const g = await requireAdminApi(req, "editor"); if ("res" in g) return g.res;
  if (Number(req.headers.get("content-length") ?? 0) > MAX_IMAGE_BYTES + 64 * 1024) return apiError("The image is larger than 2 MB.", 413);
  let form: FormData;
  try { form = await req.formData(); } catch { return apiError("Invalid upload", 400); }
  const file = form.get("file");
  if (!(file instanceof File)) return apiError("No file was uploaded.", 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const v = validateImage(bytes);
  if (!v.ok) return apiError(v.error, 422);
  const name = `${randomUUID()}.${v.kind.ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), bytes);
  return json({ path: `/uploads/${name}`, bytes: bytes.length, type: v.kind.mime }, 201);
}
