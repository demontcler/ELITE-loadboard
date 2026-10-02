"use client";

import Link from "next/link";
import { BRAND } from "@/lib/branding";
import { cn } from "@/lib/utils";

type Variant = "sidebar" | "login" | "mark";

export function BrandLogo({
  variant = "sidebar",
  href = "/",
  className,
  showTagline = true,
}: {
  variant?: Variant;
  href?: string | null;
  className?: string;
  showTagline?: boolean;
}) {
  const src =
    variant === "login"
      ? BRAND.assets.fullDark
      : variant === "mark"
        ? BRAND.assets.mark
        : BRAND.assets.fullLight;

  const img =
    variant === "mark" ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={BRAND.productName} width={36} height={36} className="h-9 w-9" />
    ) : (
      <div className="flex flex-col gap-0.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={BRAND.productName}
          width={200}
          height={40}
          className="h-10 w-auto max-w-[220px]"
        />
        {showTagline ? (
          <div
            className={cn(
              "text-[10px] tracking-wide",
              variant === "login" ? "text-slate-500" : "text-slate-400"
            )}
          >
            {BRAND.tagline}
          </div>
        ) : null}
      </div>
    );

  if (!href) return <div className={className}>{img}</div>;
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
        className
      )}
    >
      {img}
    </Link>
  );
}
