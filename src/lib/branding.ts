/**
 * Product branding — replace files under /public/brand to rebrand without code changes.
 * See docs/BRANDING.md
 */
export const BRAND = {
  productName: "ELITE Loadboard",
  shortName: "ELITE",
  tagline: "Oilfield · Pipe · Flatbed TMS",
  legalName: "ELITE Logistics",
  version: "1.0.0",
  /** Public paths (replace these files to update logos) */
  assets: {
    mark: "/brand/logo-mark.svg",
    fullLight: "/brand/logo-full-light.svg", // for dark backgrounds (sidebar)
    fullDark: "/brand/logo-full-dark.svg", // for light backgrounds (login)
    favicon: "/brand/favicon.svg",
    appleTouch: "/brand/apple-touch-icon.png",
  },
  colors: {
    primary: "#f59e0b", // amber-500
    primaryDark: "#d97706",
    ink: "#0f172a",
    slate: "#1e293b",
  },
} as const;
