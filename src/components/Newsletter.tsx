"use client";
import { useState } from "react";
import { SectionHeading } from "./ui/SectionHeading";

// Demo: no mailing-list backend is connected, so nothing is stored or sent. The page says so.
export function Newsletter() {
  const [done, setDone] = useState(false);
  return (
    <section className="on-dark mt-20 bg-deep py-16 text-white" aria-labelledby="nl-title">
      <div className="container-page grid items-center gap-8 md:grid-cols-2">
        <SectionHeading id="nl-title" tone="dark" eyebrow="Newsletter" title="Fresh offers, straight to your inbox" description="Weekly specials, new products and delivery updates." />
        {done ? <p role="status" className="rounded-xl bg-white/10 p-5 text-sm">Thanks for your interest. (Demo form: sign-ups aren&apos;t saved yet.)</p> : (
          <form onSubmit={(e) => { e.preventDefault(); setDone(true); }}>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label htmlFor="nl-email" className="sr-only">Email address</label>
              <input id="nl-email" type="email" required autoComplete="email" placeholder="you@example.com" className="input flex-1 border-transparent" />
              <button className="btn-gold">Subscribe</button>
            </div>
            <p className="mt-2 text-xs text-white/70">Demo form: sign-ups aren&apos;t stored until a mailing list is connected.</p>
          </form>
        )}
      </div>
    </section>
  );
}
