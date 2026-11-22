"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Pause, Play, ShieldCheck, Snowflake, Sparkles } from "lucide-react";
import type { ContentMap, DeliveryConfig } from "@/lib/content/schema";
import { ButtonLink } from "./ui/Button";

interface HeroProps {
  hero?: ContentMap["hero"];
  commerce?: DeliveryConfig;
}

export function Hero({ hero, commerce }: HeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Check prefers-reduced-motion preference
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) {
      video.pause();
      setIsPlaying(false);
    }

    const handleMotionChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        video.pause();
        setIsPlaying(false);
      }
    };

    if (motionQuery.addEventListener) {
      motionQuery.addEventListener("change", handleMotionChange);
    } else if ((motionQuery as unknown as { addListener?: (cb: (e: MediaQueryListEvent) => void) => void }).addListener) {
      (motionQuery as unknown as { addListener: (cb: (e: MediaQueryListEvent) => void) => void }).addListener(handleMotionChange);
    }

    // Autoplay when permitted
    if (!motionQuery.matches) {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => setIsPlaying(true))
          .catch(() => {
            setIsPlaying(false);
          });
      }
    }

    return () => {
      if (motionQuery.removeEventListener) {
        motionQuery.removeEventListener("change", handleMotionChange);
      } else if ((motionQuery as unknown as { removeListener?: (cb: (e: MediaQueryListEvent) => void) => void }).removeListener) {
        (motionQuery as unknown as { removeListener: (cb: (e: MediaQueryListEvent) => void) => void }).removeListener(handleMotionChange);
      }
    };
  }, []);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  return (
    <section
      aria-labelledby="hero-title"
      className="relative w-full overflow-hidden bg-deep min-h-[500px] sm:min-h-[580px] lg:min-h-[660px] xl:min-h-[720px] flex items-center"
    >
      {/* Background Video */}
      {!hasError && (
        <video
          ref={videoRef}
          src="/videos/meatbond-homepage.mp4"
          poster="/videos/meatbond-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          controls={false}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onLoadedData={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-700 ${
            isLoaded ? "opacity-100" : "opacity-90"
          }`}
          aria-hidden="true"
        />
      )}

      {/* Static Realistic Food Photography Fallback */}
      {hasError && (
        <div
          className="absolute inset-0 h-full w-full bg-cover bg-center"
          style={{ backgroundImage: "url('/videos/meatbond-poster.jpg')" }}
          aria-hidden="true"
        />
      )}

      {/* Refined Dark Forest-Green Gradient Overlay: Crisp Legibility Without Excessive Watermarks */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-deep/95 via-deep/80 to-deep/40 sm:from-deep/92 sm:via-deep/70 sm:to-transparent pointer-events-none"
        aria-hidden="true"
      />

      {/* Hero Foreground Content */}
      <div className="container-page relative z-10 py-16 sm:py-20 lg:py-28">
        <div className="max-w-2xl text-left">
          {/* Eyebrow badge: Clean brand pill without distracting pulse animation */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-deep/75 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-white backdrop-blur-md shadow-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
            MEATBOND MART
          </div>

          {/* Main Headline */}
          <h1
            id="hero-title"
            className="mt-4 text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-[3.6rem] drop-shadow-md"
          >
            Quality That Builds Trust.
          </h1>

          {/* Supporting Text */}
          <p className="mt-4 max-w-xl text-lg sm:text-xl font-medium leading-relaxed text-mint-light drop-shadow">
            Fresh Choices. Better Living.
          </p>

          {/* Trust Highlights */}
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs sm:text-sm font-medium text-white/90">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-gold" aria-hidden="true" /> 100% Halal Verified
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Snowflake size={16} className="text-mint" aria-hidden="true" /> Chilled Delivery
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles size={16} className="text-gold" aria-hidden="true" /> Packed Fresh to Order
            </span>
          </div>

          {/* Action Buttons */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <ButtonLink
              href="/shop"
              variant="gold"
              className="group px-8 py-3.5 text-base font-bold shadow-lift transition-all hover:scale-[1.02] hover:brightness-110 active:scale-[0.98] inline-flex items-center gap-2"
            >
              <span>SHOP NOW</span>
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </ButtonLink>

            <ButtonLink
              href="/shop?category=processed-meat"
              variant="outline"
              className="border-white/30 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 px-6 py-3.5 text-base font-semibold"
            >
              Explore Cuts
            </ButtonLink>
          </div>
        </div>
      </div>

      {/* Accessible Floating Play/Pause Control Button */}
      <div className="absolute bottom-6 right-6 z-20 sm:bottom-8 sm:right-8">
        <button
          type="button"
          onClick={togglePlayPause}
          aria-label={isPlaying ? "Pause background video" : "Play background video"}
          aria-pressed={!isPlaying}
          title={isPlaying ? "Pause background video" : "Play background video"}
          className="group inline-flex items-center gap-2 rounded-full border border-white/25 bg-deep/75 px-4 py-2 text-xs font-semibold text-white shadow-lift backdrop-blur-md transition-all hover:bg-deep/95 hover:border-gold/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold"
        >
          {isPlaying ? (
            <>
              <Pause size={16} className="text-gold transition-transform group-hover:scale-110" aria-hidden="true" />
              <span className="hidden sm:inline">Pause video</span>
            </>
          ) : (
            <>
              <Play size={16} className="text-gold fill-gold transition-transform group-hover:scale-110" aria-hidden="true" />
              <span className="hidden sm:inline">Play video</span>
            </>
          )}
        </button>
      </div>
    </section>
  );
}
