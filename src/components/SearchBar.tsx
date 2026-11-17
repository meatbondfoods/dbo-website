"use client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Search } from "lucide-react";

export function SearchBar({ onDone, autoFocus = false }: { onDone?: () => void; autoFocus?: boolean }) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState("");
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); const t = q.trim(); router.push(t ? `/shop?q=${encodeURIComponent(t)}` : "/shop"); setQ(""); onDone?.(); }} className="relative w-full">
      <label htmlFor={id} className="sr-only">Search products</label>
      <input id={id} type="search" value={q} onChange={(e) => setQ(e.target.value)} autoFocus={autoFocus} placeholder="Search chicken, beef, sausage…" className="input pr-12" />
      <button type="submit" aria-label="Search" className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-brand hover:bg-mint-light"><Search size={18} aria-hidden /></button>
    </form>
  );
}
