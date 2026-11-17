"use client";
import { useState } from "react";

// Demo: no mailing-list backend is connected yet, so nothing is stored or sent.
export function Newsletter() {
  const [done, setDone] = useState(false);
  return (
    <section className="bg-forest py-16 text-cream" aria-labelledby="nl-title">
      <div className="container-page grid items-center gap-8 md:grid-cols-2">
        <div>
          <h2 id="nl-title" className="font-serif text-3xl text-cream">Fresh offers, straight to your inbox</h2>
          <p className="mt-3 max-w-md text-sm text-cream/75">Weekly specials, new cuts and delivery updates. No spam, unsubscribe anytime.</p>
        </div>
        {done ? (
          <p role="status" className="text-sm text-cream">Thank you. You&apos;re on the list.</p>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); setDone(true); }} className="flex flex-col gap-3 sm:flex-row">
            <label htmlFor="nl-email" className="sr-only">Email address</label>
            <input id="nl-email" type="email" required placeholder="you@example.com" className="input flex-1 border-transparent text-charcoal" />
            <button className="btn bg-cream text-forest hover:bg-white">Subscribe</button>
          </form>
        )}
      </div>
    </section>
  );
}
