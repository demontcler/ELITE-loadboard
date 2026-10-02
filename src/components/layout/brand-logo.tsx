"use client";

import Link from "next/link";
import { BRAND, brandMarkFor, type BrandSurface } from "@/lib/branding";
import { cn } from "@/lib/utils";

type Variant = "sidebar" | "login" | "mark" | "header";

export function BrandLogo({
  variant = "sidebar",
  href = "/",
  className,
  showWordmark = true,
  showTagline = false,
  size = "md",
}: {
  variant?: Variant;
  href?: string | null;
  className?: string;
  showWordmark?: boolean;
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const surface: BrandSurface =
    variant === "sidebar" || variant === "header" ? "dark" : "light";
  const src = brandMarkFor(surface);

  const markClass =
    size === "lg" ? "h-16 w-16" : size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const titleClass =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base";
  const textTone = surface === "dark" ? "text-slate-100" : "text-slate-900";
  const mutedTone = surface === "dark" ? "text-slate-400" : "text-slate-500";

  const inner = (
    <div className={cn("flex items-center gap-3", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={BRAND.productName}
        width={128}
        height={118}
        className={cn(markClass, "shrink-0 object-contain")}
      />
      {showWordmark ? (
        <div className="min-w-0 leading-tight">
          <div className={cn("font-semibold tracking-[0.14em]", titleClass, textTone)}>
            {BRAND.shortName}
          </div>
          <div className={cn("text-[11px] font-medium", mutedTone)}>Loadboard TMS</div>
          {showTagline ? (
            <div className={cn("mt-0.5 text-[10px]", mutedTone)}>{BRAND.tagline}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  if (!href) return inner;
  return (
    <Link
      href={href}
      className="block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      aria-label={BRAND.productName}
    >
      {inner}
    </Link>
  );
}
