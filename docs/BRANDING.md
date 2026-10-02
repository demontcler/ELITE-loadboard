# Branding & logos

Official ELITE monogram marks are stored under `public/brand/`.

## Asset map

| File | Color | Use on |
|---|---|---|
| `logo-mark-dark.png` | Black mark | Light backgrounds (login card areas, invoices, light UI) |
| `logo-mark-light.png` | White mark | Dark backgrounds (sidebar, login splash, dark headers) |
| `favicon.png` | Mark on dark tile | Browser tab |
| `favicon-32.png` | Black mark | Small favicon |
| `apple-touch-icon.png` | Black mark | iOS home screen |
| `logo-mark-512.png` | Black mark | PWA / large icon |

The app selects light vs dark automatically via `brandMarkFor()` in `src/lib/branding.ts`.

## Where it appears

- **Login** — white mark + wordmark on dark slate splash
- **Sidebar** — white mark + ELITE wordmark
- **Mobile header** — black mark on white bar
- **Favicon / manifest** — generated from the official mark

## Replacing artwork later

Overwrite the PNG files above with the same filenames (keep transparent backgrounds).  
Restart or hard-refresh after replacing.
