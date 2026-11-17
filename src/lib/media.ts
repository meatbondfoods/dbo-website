// Image upload validation. Pure (no imports) so it is unit-tested. The client's file name and MIME type are NEVER
// trusted: the type is decided from the file's own leading bytes. SVG is refused (it can carry scripts).
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export type ImageKind = { ext: "png" | "jpg" | "webp"; mime: "image/png" | "image/jpeg" | "image/webp" };

export function sniffImage(b: Uint8Array): ImageKind | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return { ext: "png", mime: "image/png" };
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", mime: "image/jpeg" };
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return { ext: "webp", mime: "image/webp" };
  return null;
}

export function validateImage(b: Uint8Array): { ok: true; kind: ImageKind } | { ok: false; error: string } {
  if (b.length === 0) return { ok: false, error: "The file is empty." };
  if (b.length > MAX_IMAGE_BYTES) return { ok: false, error: "The image is larger than 2 MB." };
  const kind = sniffImage(b);
  return kind ? { ok: true, kind } : { ok: false, error: "Only PNG, JPEG or WebP images are allowed." };
}
