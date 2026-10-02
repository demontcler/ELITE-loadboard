# ELITE Loadboard TMS

**Version 1.0.0** — Oilfield / pipe / flatbed Transportation Management System.

```
Customer → Job → Truck Assignments → Cargo Items
                 ↘ Documents / Status / Accounting
```

## Quick start (local)

```bash
cp .env.example .env
# set DATABASE_URL and AUTH_SECRET

npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open http://localhost:3000

## Branding / logos

Drop company artwork into `public/brand/` using the filenames in [docs/BRANDING.md](./docs/BRANDING.md).  
Interim ELITE SVG marks ship with v1.0 and are replaced by overwriting those files.

## Documentation

| Doc | Purpose |
|---|---|
| [PROJECT_SPEC.md](./PROJECT_SPEC.md) | Architecture & phase status |
| [CHANGELOG.md](./CHANGELOG.md) | Release notes |
| [docs/BRANDING.md](./docs/BRANDING.md) | Logo drop-in guide |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Staging / production prep |
| [docs/RELEASE_CHECKLIST.md](./docs/RELEASE_CHECKLIST.md) | Go-live checklist |
| [docs/BACKUP_AND_RECOVERY.md](./docs/BACKUP_AND_RECOVERY.md) | Backups |
| [docs/OPERATIONS_RUNBOOK.md](./docs/OPERATIONS_RUNBOOK.md) | Incidents |
| [docs/RBAC_MATRIX.md](./docs/RBAC_MATRIX.md) | Permissions |

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build & start |
| `npm run test:all` | Full regression suite |
| `npm run bootstrap:admin` | First production admin |
| `npm run db:migrate:deploy` | Production migrations |

## Status

Phases **1–8 COMPLETE** · Product **v1.0.0**  
Deploy only after [release checklist](./docs/RELEASE_CHECKLIST.md) and manual approval.
