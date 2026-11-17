import "server-only";
import { draftMode } from "next/headers";
import { getRepositories } from "../repositories";
import { getContent } from "./store";
import { applyDisplay } from "./display";
import type { ContentKey, ContentMap } from "./schema";

/** Content for rendering a page. Reads the draft only when the admin has enabled Next.js draft mode (dev only). */
export async function pageContent<K extends ContentKey>(key: K): Promise<ContentMap[K]> {
  const { isEnabled } = await draftMode();
  return getContent(key, { preview: isEnabled });
}

/** Catalogue as the storefront shows it: ERP/demo data + admin display settings. Never alters price or stock. */
export async function getStorefront() {
  const { catalog } = getRepositories();
  const [categories, products, display] = await Promise.all([catalog.listCategories(), catalog.listProducts(), pageContent("productDisplay")]);
  return { categories, ...applyDisplay(products, display) };
}
