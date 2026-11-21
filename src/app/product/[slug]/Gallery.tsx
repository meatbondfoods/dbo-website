"use client";
import { ProductImage } from "@/components/ProductImage";
import { useState } from "react";

export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [i, setI] = useState(0);
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-2xl border border-hairline bg-mint-light shadow-soft">
        <ProductImage src={images[i]} alt={images.length ? `${name}, image ${i + 1} of ${images.length}` : name} priority sizes="(min-width:1024px) 50vw, 100vw" />
      </div>
      {images.length > 1 && (
        <div className="mt-4 flex gap-3" role="group" aria-label="Product images">
          {images.map((src, n) => (
            <button key={src} onClick={() => setI(n)} aria-label={`Show image ${n + 1}`} aria-pressed={n === i}
              className={`relative h-20 w-20 overflow-hidden rounded-lg border-2 transition-colors ${n === i ? "border-brand" : "border-hairline hover:border-ink-soft"}`}>
              <ProductImage src={src} alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
