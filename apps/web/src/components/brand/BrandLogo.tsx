import { cn } from "@throughline/ui";
import { brandOf, brandUrl } from "./brands";

const SIZE = {
  xs: { tile: "size-5 rounded-xs p-0.5", text: "text-nano" },
  sm: { tile: "size-7 rounded-sm p-1", text: "text-nano" },
  md: { tile: "size-9 rounded-md p-1.5", text: "text-micro" },
  lg: { tile: "size-11 rounded-lg p-2", text: "text-caption" },
} as const;

/**
 * A vendor's official logo on a neutral tile, or the fallback initials when we have no logo for
 * it. Decorative: always render the product's name next to it.
 */
export function BrandLogo({
  brand,
  fallback,
  size = "sm",
  className,
}: {
  /** Integration id, tool id or product name. */
  brand: string | null | undefined;
  /** Shown when there's no logo, e.g. "CC". */
  fallback?: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const id = brandOf(brand);
  const src = id ? brandUrl(id) : null;
  const s = SIZE[size];
  if (!src)
    return (
      <span
        aria-hidden
        className={cn(
          "border-line-strong bg-surface-raised text-subtle flex shrink-0 items-center justify-center border font-mono",
          s.tile,
          s.text,
          className,
        )}
      >
        {fallback ?? (brand ?? "?").slice(0, 2).toUpperCase()}
      </span>
    );
  return (
    <span
      aria-hidden
      className={cn(
        "bg-brand-tile border-line flex shrink-0 items-center justify-center border",
        s.tile,
        className,
      )}
    >
      <img src={src} alt="" className="size-full object-contain" draggable={false} />
    </span>
  );
}
