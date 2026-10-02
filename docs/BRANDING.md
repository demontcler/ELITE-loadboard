# Branding & logos

ELITE Loadboard v1.0 uses drop-in brand assets under `public/brand/`.

## Replace these files (keep the same filenames)

| File | Use |
|---|---|
| `public/brand/logo-mark.svg` | Compact mark (mobile header) |
| `public/brand/logo-full-light.svg` | Full logo on **dark** backgrounds (sidebar) |
| `public/brand/logo-full-dark.svg` | Full logo on **light** backgrounds (login) |
| `public/brand/favicon.svg` | Browser tab icon |
| `public/brand/apple-touch-icon.png` | Optional 180×180 PNG for iOS home screen |

After replacing files, restart the Next.js server (or hard-refresh) so assets reload.

## Recommended specs

- **Mark:** square SVG or PNG, transparent, readable at 36×36
- **Full logos:** ~280×56 (or similar wide), transparent
- **Favicon:** SVG preferred; PNG 32×32 also fine if you update `src/lib/branding.ts`
- Prefer vector SVG for crisp sidebar/login rendering

## Text / colors

Product strings and accent colors live in `src/lib/branding.ts`:

- `productName`, `shortName`, `tagline`, `legalName`
- `colors.primary` (default amber `#f59e0b`)

CSS variables in `src/app/globals.css`:

- `--brand-primary`
- `--brand-ink`
- `--brand-sidebar`

## Where branding appears

- Login screen
- App sidebar + version footer
- Mobile header mark
- Document title / favicon metadata

## Providing company artwork

1. Export your logos as SVG (preferred) or transparent PNG
2. Overwrite the files listed above **or** place custom filenames and update paths in `src/lib/branding.ts`
3. Do not commit secrets; logos are public static assets by design
