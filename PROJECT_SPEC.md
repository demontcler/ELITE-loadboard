# ELITE Loadboard — Oilfield / Flatbed Logistics TMS

## 1. What Exists Today

Repository status (as of project kickoff):

- Git repo named **ELITE-loadboard**
- Single file: `README.md` (`# ELITE-loadboard`)
- No application code, no package manager config, no database schema

This is a greenfield build.

---

## 2. Technical Architecture

### Stack (locked decisions)

| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 15 (App Router)** | Full-stack TypeScript, API routes + RSC, production-ready |
| Language | **TypeScript (strict)** | End-to-end type safety |
| UI | **Tailwind CSS + shadcn/ui** | Dense ops UI, accessible primitives, consistent design tokens |
| Forms | **React Hook Form + Zod** | Validated forms without boilerplate |
| Database | **PostgreSQL** | Relational integrity for multi-truck jobs, money, compliance |
| ORM | **Prisma** | Typed models, migrations, transactions |
| Auth | **Auth.js (NextAuth v5)** credentials + session | Role-based; portable to OAuth later |
| Money | **Prisma `Decimal`** | Avoid float math for rates/invoices |
| Weights | **Prisma `Decimal`** | Precise lb/ft and totals |
| Files | **Storage abstraction** → local disk now, S3/R2-compatible later | Documents are critical; provider-swappable |
| IDs | UUID PK + human-readable `displayId` | JOB-2026-000184 style identifiers |

### Core Operating Model

```
Customer
  └── Job (parent transportation order)
        └── TruckAssignment (independent operational unit)
              ├── CargoItem[] (material per truck; multi-item supported)
              ├── Documents (BOL, POD, rate conf, etc.)
              ├── Costs / Accessorials
              └── Status timeline
```

**Invariants (non-negotiable):**

1. One Job → many TruckAssignments
2. Every truck is an independent operational assignment
3. Every truck can carry different cargo
4. Every truck can have multiple CargoItems
5. Every truck has its own driver, carrier, equipment, rate, status, BOL, POD, costs
6. Parent Job aggregates operational + financial results from trucks beneath it

### Status Aggregation

- TruckAssignment has its own lifecycle status
- Job status is **derived** from truck assignment statuses (e.g. Partially Dispatched, Partially Delivered)
- Load Board columns (Future / Today / Dispatched) use date + aggregate status

### Auth & Permissions

Roles: `ADMIN` | `DISPATCHER` | `ACCOUNTING` | `OPERATIONS_MANAGER` | `VIEW_ONLY`

Permissions are checked **server-side** on every mutation/query. UI hiding is convenience only.

### Soft Delete / Integrity

- Financial records (invoices, settlements, payments), completed jobs, audit logs, and documents are never hard-deleted
- Soft-delete via `deletedAt` where archival is needed
- Multi-record writes use Prisma `$transaction`

---

## 3. Entity Relationship Overview

```
User ── Role ── Permission (RBAC)

Customer ── CustomerContact
         ── CustomerLocation
         ── CustomerDocument
         ── Job[]
         ── Invoice[]

Carrier ── CarrierContact
        ── CarrierDocument
        ── Driver[]
        ── Tractor[]
        ── Trailer[]
        ── CarrierSettlement[]

Driver ── DriverDocument
       ── TruckAssignment[]

Tractor / Trailer ── EquipmentDocument
                  ── TruckAssignment[]

Job ── TruckAssignment[]
    ── JobDocument[]
    ── Invoice[]
    ── AuditLog references

TruckAssignment ── CargoItem[]
                ── TruckAssignmentDocument[]
                ── Accessorial[]
                ── CarrierSettlement (optional)
                ── AuditLog references

Invoice ── InvoiceLineItem[]
CarrierSettlement ── SettlementLineItem[]

CompanySettings (numbering formats, weight thresholds, expires-soon days, paperwork rules)
ComplianceRequirement (configurable paperwork checklist)
AuditLog
Notification
```

### Key Job fields

Operational: jobNumber, customer, PO/refs, contacts, job type, pickup/delivery dates & times, locations (address + lat/lng + lease/well/rig + directions/gate), trucksRequired, equipment requirements, rates, billing method, notes, attachments.

### Key TruckAssignment fields

assignmentNumber, carrier, driver, tractor, trailer, equipment type, dates/times, statuses, rates, accessorials, dispatcher, notes — plus independent cargo and documents.

### Key CargoItem fields

materialCategory, description, pipe fields (type/grade/OD/wall/jointLength/joints/footage/wtPerFt), calculatedWeight, manualWeightOverride, heatNumber, bundleCount, quantity, unit, customerMaterialRef, notes.

**Weight formula (centralized utility):**

- `footage = joints × jointLength` (when both present)
- `weight = footage × weightPerFoot`
- Truck total = sum of cargo item weights (override respected per item)

---

## 4. Proposed Folder Structure

```
/
├── PROJECT_SPEC.md
├── README.md
├── package.json
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
├── src/
│   ├── app/
│   │   ├── (auth)/login/...
│   │   ├── (app)/                 # authenticated shell
│   │   │   ├── layout.tsx         # nav shell
│   │   │   ├── page.tsx           # dashboard
│   │   │   ├── load-board/
│   │   │   ├── customers/
│   │   │   ├── carriers/
│   │   │   ├── drivers/
│   │   │   ├── equipment/
│   │   │   ├── accounting/
│   │   │   ├── documents/
│   │   │   ├── reports/
│   │   │   └── settings/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/
│   │   │   ├── search/
│   │   │   └── ...resource routes as needed
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                    # shadcn
│   │   ├── layout/                # sidebar, header, shell
│   │   ├── load-board/
│   │   ├── jobs/
│   │   ├── customers/
│   │   ├── carriers/
│   │   ├── drivers/
│   │   ├── equipment/
│   │   ├── documents/
│   │   ├── accounting/
│   │   └── shared/
│   ├── lib/
│   │   ├── auth/
│   │   ├── db.ts                  # prisma client
│   │   ├── storage/               # file storage abstraction
│   │   ├── permissions/
│   │   ├── validators/            # zod schemas
│   │   ├── calculations/          # pipe, weight, financial, job status
│   │   ├── identifiers.ts         # JOB-/TRK-/INV- generators
│   │   └── utils.ts
│   ├── server/                    # server actions / services
│   │   ├── customers.ts
│   │   ├── carriers.ts
│   │   ├── drivers.ts
│   │   ├── equipment.ts
│   │   ├── jobs.ts
│   │   ├── truck-assignments.ts
│   │   ├── cargo.ts
│   │   ├── documents.ts
│   │   ├── accounting.ts
│   │   ├── compliance.ts
│   │   ├── audit.ts
│   │   └── search.ts
│   └── types/
│       └── index.ts
├── .env.example
└── .env
```

---

## 5. Environment Variables

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/elite_loadboard
AUTH_SECRET=                          # openssl rand -base64 32
NEXTAUTH_URL=http://localhost:3000
# Optional object storage (local filesystem used if unset)
STORAGE_PROVIDER=local                # local | s3
STORAGE_LOCAL_PATH=./storage
# S3/R2 (future)
# S3_BUCKET=
# S3_REGION=
# S3_ACCESS_KEY_ID=
# S3_SECRET_ACCESS_KEY=
# S3_ENDPOINT=
```

---

## 6. Architectural Decisions (resolved)

| Decision | Choice |
|---|---|
| Monolith vs split backend | **Next.js monolith** (App Router + Server Actions + selective API routes) |
| Auth provider | **Credentials (local users)** first; OAuth-ready via Auth.js |
| File storage | **Local disk abstraction** with S3 interface for production swap |
| Money / weights | **Decimal** everywhere; centralized calc utilities |
| Job status | **Derived aggregate** from truck assignments + explicit overrides for Draft/Cancelled |
| Soft delete | Yes for customers/carriers/drivers/equipment/jobs; never for audit; archive invoices |
| Numbering | Configurable formats in CompanySettings; defaults JOB-YYYY-######, TRK-###, INV-YYYY-##### |
| Seed data | Dev seed only (admin user + sample oilfield demo data) — never hard-coded into UI |

---

## 7. Implementation Phases

### PHASE 1 — Foundation ✅
- Next.js + Tailwind + UI primitives
- Prisma schema (full core models) + initial migration
- Auth.js credentials + RBAC
- App shell / navigation
- Dense ops design direction
- Calculation utilities (pipe, weight, financial, job status, compliance, paperwork)
- CompanySettings + compliance requirement seed
- Identifier generators + storage abstraction + audit helper

### PHASE 2 — Master Data ✅
- Customers (+ contacts, locations, job history views)
- Carriers (+ drivers/equipment summary, compliance doc placeholders)
- Drivers (+ CDL/medical expiration status)
- Equipment (tractors/trailers)

### PHASE 3 — Jobs Core ✅
- Job CRUD with oilfield location fields
- TruckAssignment generation (N trucks)
- CargoItems + pipe weight calculator (centralized)
- Multi-truck builder (add/remove/duplicate)
- Job detail screen with per-truck cargo

## Phase 1–4 status (post-audit)

| Phase | Verdict | Notes |
|---|---|---|
| 1 Foundation | **COMPLETE** | Auth, schema, shell, calcs, seed — verified |
| 2 Master data | **PARTIAL** | Create/list/detail work; edit UIs and carrier-contact UI incomplete |
| 3 Jobs core | **COMPLETE** (with gaps) | Multi-truck + cargo isolation verified via UI+DB; tractor/trailer ID pickers and bulk-assign UI incomplete |
| 4 Load board | **PARTIAL** | Future/Today/Dispatched works with real data; advanced filters not built |

See latest audit commit / report for Fixed / Missing / Technical Debt.

### PHASE 5 — Documents & Compliance
- Upload/download via storage abstraction
- Per-entity documents
- Expiration warnings
- Paperwork checklist / payment holds

### PHASE 6 — Accounting
- Job & truck profitability
- AR invoices
- AP settlements
- Accessorials
- Paperwork-gated payment readiness

### PHASE 7 — Dashboard, Search, Reports
- Executive metrics with deep links
- Global search
- Basic operational reports

### PHASE 8 — Polish
- Lint / typecheck / tests
- Security pass
- Performance (indexes, pagination)
- Seed demo dataset
- README / runbook

---

## 8. Calculation Services (centralized)

| Module | Responsibility |
|---|---|
| `lib/calculations/pipe.ts` | Footage & weight from joints / lb-ft |
| `lib/calculations/weight.ts` | Cargo item + truck totals; threshold warnings |
| `lib/calculations/financial.ts` | Revenue, cost, margin, % |
| `lib/calculations/job-status.ts` | Aggregate parent status from trucks |
| `lib/calculations/compliance.ts` | Document valid / expires soon / expired / missing |
| `lib/calculations/paperwork.ts` | Checklist completeness → payment hold |

---

## 9. Success Criteria for MVP

Dispatchers can:

1. Create a multi-truck oilfield job
2. Assign different cargo to each truck
3. See accurate weight totals and overweight warnings
4. Operate from Future / Today / Dispatched load board
5. Track BOL/POD per truck
6. See job profitability and AR/AP status
7. Get compliance and paperwork alerts

---

## 10. Future Capabilities (architected, not built now)

Driver/customer/carrier portals, SMS/email, GPS/ELD, QuickBooks, digital signatures, OCR, geofencing, rate tables, mileage/maps — core entities must not block these.
