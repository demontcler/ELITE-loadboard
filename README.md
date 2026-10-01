# ELITE Loadboard TMS

Oilfield / pipe / flatbed **Transportation Management System**.

Core operating model:

```
Customer → Job → Truck Assignments → Cargo Items
                 ↘ Documents / Status / Accounting
```

One job can require many trucks. Every truck is an independent assignment with its own cargo, driver, carrier, equipment, rate, status, BOL, and POD.

See [PROJECT_SPEC.md](./PROJECT_SPEC.md) for architecture, schema, and phased roadmap.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + custom UI primitives
- PostgreSQL + Prisma
- Auth.js (NextAuth v5) credentials + RBAC
- Zod / React Hook Form / Decimal.js

## Quick start

### Prerequisites

- Node 20+
- PostgreSQL 14+

### Setup

```bash
cp .env.example .env
# edit DATABASE_URL and AUTH_SECRET

npm install
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Dev login

| Email | Password | Role |
|---|---|---|
| `admin@elite-loadboard.local` | `admin123!` | ADMIN |
| `dispatch@elite-loadboard.local` | `dispatch123!` | DISPATCHER |
| `accounting@elite-loadboard.local` | `accounting123!` | ACCOUNTING |

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm run test:calc` | Calculation unit tests |
| `npm run db:migrate` | Run migrations |
| `npm run db:seed` | Seed admin + settings |
| `npm run db:studio` | Prisma Studio |

## Implementation status

- **Phase 1** — Foundation (auth, schema, shell, calculations) — in progress / complete
- **Phase 2** — Customers, Carriers, Drivers, Equipment
- **Phase 3** — Jobs, Truck Assignments, Cargo, pipe calculator
- **Phase 4** — Load Board (Future / Today / Dispatched)
- **Phase 5** — Documents & Compliance
- **Phase 6** — Accounting / AR / AP
- **Phase 7** — Dashboard metrics, search, reports
- **Phase 8** — Polish, security, performance
