"use client";
import { useEffect, useState } from "react";
import type { DeliveryConfig } from "./content/schema";

let cache: Promise<DeliveryConfig> | null = null;
const load = () => (cache ??= fetch("/api/commerce").then((r) => r.json()).catch((e) => { cache = null; throw e; }));

/** Published delivery rule (free radius, charge, areas) for cart and checkout. */
export function useCommerce() {
  const [config, setConfig] = useState<DeliveryConfig | null>(null);
  useEffect(() => { load().then(setConfig).catch(() => setConfig(null)); }, []);
  return config;
}
