"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

export function QualityVideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Autoplay requires muted state on initial load across modern mobile/desktop browsers
    video.muted = true;
    const playPromise = video.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Handled silently if browser delays autoplay until user interaction
      });
    }

    const handleVolumeChange = () => {
      setIsMuted(video.muted);
    };

    video.addEventListener("volumechange", handleVolumeChange);
    return () => {
      video.removeEventListener("volumechange", handleVolumeChange);
    };
  }, []);

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  return (
    <div className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-hairline bg-deep shadow-soft">
      <video
        ref={videoRef}
        src="/videos/meatbond-processing.mp4"
        poster="/videos/meatbond-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        controls
        className="h-full w-full object-cover"
        aria-label="MeatBond Foods processing and hygienic handling video"
      >
        Your browser does not support the video tag.
      </video>

      {/* Quick unmute / mute floating button for enhanced customer convenience */}
      <button
        type="button"
        onClick={toggleMute}
        aria-label={isMuted ? "Unmute video" : "Mute video"}
        className="absolute top-3.5 right-3.5 z-10 inline-flex items-center gap-1.5 rounded-full bg-deep/85 px-3 py-1.5 text-xs font-semibold text-white shadow-soft backdrop-blur transition hover:bg-brand active:scale-95"
      >
        {isMuted ? (
          <>
            <VolumeX size={15} aria-hidden />
            <span>Unmute</span>
          </>
        ) : (
          <>
            <Volume2 size={15} aria-hidden />
            <span>Mute</span>
          </>
        )}
      </button>
    </div>
  );
}
