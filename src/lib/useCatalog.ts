"use client";
import { useEffect, useState } from "react";
import type { Product } from "./domain/types";

// Shared per-page-load cache so header drawer, cart and checkout don't refetch the catalogue.
let cache: Promise<Product[]> | null = null;
const load = () => (cache ??= fetch("/api/catalog").then((r) => r.json()).then((d) => d.products as Product[]).catch((e) => { cache = null; throw e; }));

/** Client-side catalogue fetch used by cart, drawer and checkout to look up names and prices. */
export function useCatalog() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { load().then(setProducts).catch(() => setError(true)); }, []);
  return { products, error };
}
