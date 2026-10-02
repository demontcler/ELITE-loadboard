# ELITE Loadboard TMS

Oilfield / pipe / flatbed **Transportation Management System**.

```
Customer → Job → Truck Assignments → Cargo Items
                 ↘ Documents / Status / Accounting
```

One job can require many trucks. Every truck is an independent assignment with its own cargo, driver, carrier, equipment, rate, status, BOL, and POD.

See [PROJECT_SPEC.md](./PROJECT_SPEC.md) for architecture and phase status.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + UI primitives
- PostgreSQL + Prisma
- Auth.js (NextAuth v5) credentials + RBAC
- Zod / React Hook Form / Decimal.js
- Private document storage (local or S3-compatible)

## Quick start (local)

### Prerequisites

- Node 20+
- PostgreSQL 14+

### Setup

```bash
cp .env.example .env
# set DATABASE_URL and AUTH_SECRET (openssl rand -base64 32)

npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Local seed creates development users only. **Default seed passwords are for local development and must never be used in production.** See README of your team secrets store for local credentials, or set `SEED_ADMIN_PASSWORD` before seeding.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build & start |
| `npm run lint` / `npm run typecheck` | Quality gates |
| `npm run test:all` | Full automated regression suite |
| `npm run db:migrate` | Dev migrations |
| `npm run db:migrate:deploy` | Production-safe migrate |
| `npm run db:seed` | Dev seed (blocked in production) |
| `npm run bootstrap:admin` | Safe first-admin bootstrap |
| `npm run audit:deps` | Dependency vulnerability audit |

## Documentation

| Doc | Purpose |
|---|---|
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Local / staging / production deploy prep |
| [docs/BACKUP_AND_RECOVERY.md](./docs/BACKUP_AND_RECOVERY.md) | Backups & restore |
| [docs/OPERATIONS_RUNBOOK.md](./docs/OPERATIONS_RUNBOOK.md) | Incident playbooks |
| [docs/RELEASE_CHECKLIST.md](./docs/RELEASE_CHECKLIST.md) | Pre-release checklist |
| [docs/RBAC_MATRIX.md](./docs/RBAC_MATRIX.md) | Role permissions |
| [docs/PHASE8_REMEDIATION_PLAN.md](./docs/PHASE8_REMEDIATION_PLAN.md) | Hardening plan |

## Status

Phases **1–8 COMPLETE** (Phase 8 = production readiness / hardening).  
**Not deployed.** Staging/production cutover requires manual approval.
