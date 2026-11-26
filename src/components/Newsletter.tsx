"use client";
import { useState } from "react";
import { SectionHeading } from "./ui/SectionHeading";

// Customer updates subscription banner
export function Newsletter() {
  const [done, setDone] = useState(false);
  return (
    <section className="on-dark mt-20 bg-deep py-16 text-white" aria-labelledby="nl-title">
      <div className="container-page grid items-center gap-8 md:grid-cols-2">
        <SectionHeading id="nl-title" tone="dark" eyebrow="VIP Offers" title="Fresh offers, straight to your inbox" description="Weekly bundle deals, restock alerts, and seasonal discounts across Chattogram." />
        {done ? <p role="status" className="rounded-xl border border-white/15 bg-white/10 p-5 text-sm font-medium">Thank you for subscribing! We&apos;ll notify you when MeatBond Mart launches new cuts and special offers.</p> : (
          <form onSubmit={(e) => { e.preventDefault(); setDone(true); }}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label htmlFor="nl-email" className="sr-only">Email address</label>
              <input id="nl-email" type="email" required autoComplete="email" placeholder="you@example.com" className="input flex-1 border-transparent" />
              <button className="btn-gold">Subscribe</button>
            </div>
            <p className="mt-2 text-xs text-white/75">Exclusive MeatBond Mart offers and fresh batch alerts — zero spam.</p>
          </form>
        )}
      </div>
    </section>
  );
}
