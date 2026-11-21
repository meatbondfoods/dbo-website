import Image from "next/image";

/**
 * A product picture that never crashes the page: products whose picture has not been uploaded in the ERP yet
 * (the ERP sends an empty list) show a quiet placeholder instead of a broken image.
 */
export function ProductImage({ src, alt, priority, sizes, className = "object-cover" }: {
  src?: string | null;
  alt: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
}) {
  if (!src) {
    return (
      <div role="img" aria-label={`${alt} (picture coming soon)`} className="absolute inset-0 flex items-center justify-center bg-mint-light text-xs font-medium text-ink-soft">
        Picture coming soon
      </div>
    );
  }
  return <Image src={src} alt={alt} fill unoptimized priority={priority} sizes={sizes} className={className} />;
}
