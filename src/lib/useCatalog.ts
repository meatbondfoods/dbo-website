"use client";
import { useEffect, useState } from "react";
import type { Product } from "./domain/types";

/** Client-side catalogue fetch used by cart and checkout to look up names and prices. */
export function useCatalog() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch("/api/catalog").then((r) => r.json()).then((d) => setProducts(d.products)).catch(() => setError(true));
  }, []);
  return { products, error };
}
