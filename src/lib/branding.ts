/**
 * Product branding — official ELITE monogram marks.
 * Replace PNG files under /public/brand to refresh artwork.
 * See docs/BRANDING.md
 */
export const BRAND = {
  productName: "ELITE Loadboard",
  shortName: "ELITE",
  tagline: "Oilfield · Pipe · Flatbed TMS",
  legalName: "ELITE Logistics",
  version: "1.0.0",
  /**
   * Official monogram:
   * - dark = black mark for light backgrounds (login, invoices, light UI)
   * - light = white mark for dark backgrounds (sidebar, dark headers)
   */
  assets: {
    markDark: "/brand/logo-mark-dark.png",
    markLight: "/brand/logo-mark-light.png",
    /** Convenience aliases */
    mark: "/brand/logo-mark-dark.png",
    markOnDark: "/brand/logo-mark-light.png",
    favicon: "/brand/favicon.png",
    favicon32: "/brand/favicon-32.png",
    appleTouch: "/brand/apple-touch-icon.png",
  },
  colors: {
    primary: "#f59e0b",
    primaryDark: "#d97706",
    ink: "#0f172a",
    slate: "#020617",
  },
} as const;

export type BrandSurface = "dark" | "light";

/** Pick the correct monogram for the background surface. */
export function brandMarkFor(surface: BrandSurface): string {
  return surface === "dark" ? BRAND.assets.markLight : BRAND.assets.markDark;
}
