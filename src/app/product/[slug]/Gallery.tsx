"use client";
import Image from "next/image";
import { useState } from "react";

export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [i, setI] = useState(0);
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-md border border-line bg-cream-deep">
        <Image src={images[i]} alt={`${name}, view ${i + 1}`} fill unoptimized priority sizes="(min-width:768px) 50vw, 100vw" className="object-cover" />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex gap-3">
          {images.map((src, n) => (
            <button key={src} onClick={() => setI(n)} aria-label={`Show image ${n + 1}`} aria-current={n === i}
              className={`relative h-20 w-20 overflow-hidden rounded-md border ${n === i ? "border-forest" : "border-line"}`}>
              <Image src={src} alt="" fill unoptimized className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
