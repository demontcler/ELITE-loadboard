# Changelog

## 1.0.0 — Production v1

### Product
- Phases 1–8 complete: TMS core, documents/compliance, accounting, dashboard/reports/search, production hardening
- Branding system with drop-in logos under `public/brand/`
- Login and shell use product branding; version shown in sidebar

### Security & ops
- Environment isolation, seed safeguards, bootstrap admin
- Private document storage adapter (local / S3-compatible)
- RBAC user management, session revocation for deactivated users
- Health check, security headers, structured logging
- Deployment, backup, runbook, and release documentation

### Notes
- Not auto-deployed; staging/production require manual cutover
- Replace interim ELITE SVG marks with final company artwork per `docs/BRANDING.md`
