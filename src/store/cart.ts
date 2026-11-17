"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useEffect, useState } from "react";
import type { CartLine } from "@/lib/domain/types";

interface CartState {
  lines: CartLine[];
  add: (line: CartLine) => void;
  setQty: (productId: string, optionId: string, quantity: number) => void;
  remove: (productId: string, optionId: string) => void;
  clear: () => void;
}

const same = (a: CartLine, p: string, o: string) => a.productId === p && a.optionId === o;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      add: (line) =>
        set((s) => {
          const hit = s.lines.find((l) => same(l, line.productId, line.optionId));
          return hit
            ? { lines: s.lines.map((l) => (l === hit ? { ...l, quantity: Math.min(50, l.quantity + line.quantity) } : l)) }
            : { lines: [...s.lines, line] };
        }),
      setQty: (p, o, q) =>
        set((s) => ({ lines: s.lines.map((l) => (same(l, p, o) ? { ...l, quantity: Math.max(1, Math.min(50, q)) } : l)) })),
      remove: (p, o) => set((s) => ({ lines: s.lines.filter((l) => !same(l, p, o)) })),
      clear: () => set({ lines: [] }),
    }),
    { name: "mart-cart" },
  ),
);

/** True after mount, so server and first client render agree (cart lives in localStorage). */
export function useHydrated() {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}
