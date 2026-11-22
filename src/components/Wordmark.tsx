import Link from "next/link";

interface WordmarkProps {
  light?: boolean;
  logo?: { path?: string; alt?: string };
}

/** Official MeatBond MART brand logo */
export function Wordmark({ light = false, logo }: WordmarkProps) {
  const logoPath = logo?.path || "/meatbond-mart-logo.png";
  const logoAlt = logo?.alt || "MeatBond MART";

  if (light) {
    // Footer presentation: crisp white rounded card/badge ensuring high visibility against the dark forest-green footer
    return (
      <Link href="/" aria-label="MeatBond MART, home" className="inline-flex items-center">
        <div className="inline-flex items-center justify-center rounded-xl bg-white px-3.5 py-2 shadow-soft transition-transform hover:scale-[1.02]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoPath}
            alt={logoAlt}
            className="h-10 sm:h-11 w-auto max-w-[170px] sm:max-w-[190px] object-contain"
          />
        </div>
      </Link>
    );
  }

  // Header presentation: desktop ~48-54px, mobile ~38-44px, crisp alignment on white header
  return (
    <Link href="/" aria-label="MeatBond MART, home" className="inline-flex items-center py-1">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logoPath}
        alt={logoAlt}
        className="h-[38px] sm:h-[44px] md:h-[50px] lg:h-[52px] w-auto max-w-[180px] sm:max-w-[210px] object-contain transition-transform hover:opacity-95"
      />
    </Link>
  );
}
