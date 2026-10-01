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
- **Job soft-delete / archive:** setting `deletedAt` on a Job also soft-deletes (archives) all of its TruckAssignments in the same transaction and marks them `CANCELLED`. Operational lists exclude `deletedAt != null`. Historical rows remain in the database for audit/history — no orphan trucks remain visible on the load board.

### Revenue Hierarchy (authoritative rule)

Job financial aggregation distinguishes parent Job customer rate from truck-level allocations:

1. **If the parent Job has an explicit `customerRate`**, that value is the authoritative Job revenue. Truck `revenueAllocation` values may still be used for per-truck profitability views but are **not** added again into parent Job revenue (no double-counting).
2. **If no parent Job `customerRate` is supplied**, Job revenue is derived as the sum of active (non-cancelled) truck `revenueAllocation` values.
3. Job cost is always aggregated from TruckAssignment costs (carrier/driver rates + accessorials + additional costs).

This rule is implemented in `recalculateJobAggregates` (`src/server/jobs.ts`) and covered by integration tests.

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

### PHASE 1 — Foundation ✅ COMPLETE
- Next.js + Tailwind + UI primitives
- Prisma schema (full core models) + migrations
- Auth.js credentials + RBAC (server-side enforcement + UI `Can` gating)
- App shell / navigation (product labels; no phase banners in UI)
- Calculation utilities (pipe, weight, financial, job status, compliance, paperwork)
- CompanySettings (company, timezone, units, job numbering, weight warning threshold)
- Identifier generators (collision-safe within transactions) + storage abstraction + audit helper
- Global search (jobs, customers, carriers, drivers, equipment; extensible for BOL/POD/invoice later)

### PHASE 2 — Master Data ✅ COMPLETE
- Customers: create / view / edit / archive + contacts + locations + notes/billing
- Carriers: create / view / edit / archive + MC/USDOT + dispatch/accounting contacts + notes
- Drivers: create / view / edit / archive + CDL/medical/TWIC + carrier relationship + notes
- Equipment: tractors & trailers create / view / edit / deactivate with unit/make/model/type/length
- Dedicated forms with field-level validation (no raw Zod errors in UI)

### PHASE 3 — Jobs Core ✅ COMPLETE
- Job create with oilfield location fields (dedicated form)
- TruckAssignment generation (N trucks) + add / remove / duplicate
- CargoItems per truck + pipe weight calculator (centralized); cargo never bulk-overwritten
- Tractor + trailer selectors (DB records; filterable by carrier) with Unit/Make/Model and Type/Length labels
- Bulk truck actions: assign carrier, pickup date/time, equipment/trailer type
- Job detail multi-truck workspace (TRUCK #, DRIVER, CARRIER, TRACTOR, TRAILER, CARGO, FOOTAGE, WEIGHT, STATUS + need badges)
- Soft-delete job archives child truck assignments
- Revenue hierarchy: parent `customerRate` authoritative when set; else sum of truck allocations

### PHASE 4 — Load Board ✅ COMPLETE
- Future / Today / Dispatched columns from real assignment data
- Server-side filters: customer, date range, job status, dispatcher, carrier, driver, pickup/delivery location, jobs needing trucks, free-text; clear + combine filters; empty states
- Job cards show trucks required / assigned / dispatched / delivered / needed from TruckAssignment data

## Phase 1–5 status

| Phase | Verdict | Notes |
|---|---|---|
| 1 Foundation | **COMPLETE** | Auth, schema, shell, calcs, settings, global search, seed — verified |
| 2 Master data | **COMPLETE** | Full CRUD/archive workflows for customers, carriers, drivers, equipment |
| 3 Jobs core | **COMPLETE** | Multi-truck independence, equipment selection, bulk actions, revenue rule |
| 4 Load board | **COMPLETE** | Columns + operational filters + accurate truck counts |
| 5 Documents | **COMPLETE** | Per-truck BOL/POD independence, compliance center, secure storage, holds |
| 6 Accounting | **COMPLETE** | AR/AP, paperwork holds, settlements, profitability, accessorials |
| 7 Dashboard / Reports / Search | **COMPLETE** | Live metrics, ops/financial reports, CSV export, expanded search |

Do **not** begin Phase 8 until explicitly approved.

### PHASE 5 — Documents & Compliance ✅ COMPLETE
- Per-entity documents (Job, TruckAssignment, Customer, Carrier, Driver, Tractor, Trailer)
- Storage abstraction (local now; S3-ready keys); secure download via `/api/documents/...`
- Truck BOL/POD paperwork independence + Job paperwork aggregation
- Configurable ComplianceRequirement (BOL/POD required; payment/invoice holds)
- Expiration engine (VALID / EXPIRES_SOON / EXPIRED / MISSING)
- Compliance Center with filters; dispatch WARNING_ONLY compliance alerts
- Document replace archives prior current (history preserved)
- Mobile-friendly upload (file + camera capture)
- Integration: `npm run test:phase5`

### PHASE 6 — Accounting ✅ COMPLETE
- Accounting Center: Overview, AR/Invoices, AP/Payables, Settlements, Ready to Invoice, Holds, Accessorials, AR Aging, Profitability
- Decimal-safe money; Job + Truck profitability with revenue hierarchy (no double-count)
- Accessorials (detention, fuel, TONU, etc.) with customer/carrier split
- Invoice readiness from Phase 5 paperwork (NOT_READY with explicit hold reasons)
- Customer payments (partial → PARTIALLY_PAID; balance recalculation)
- CarrierPayable per TruckAssignment; PAPERWORK_HOLD until POD; sync on document upload
- Settlements from multiple payables
- Audit logs for invoice/payment/payable/settlement/accessorial actions
- Integration: `npm run test:phase6`

### PHASE 7 — Dashboard, Search, Reports ✅ COMPLETE
- Executive/ops dashboard with clickable live metrics (ops + accounting when permitted)
- Operations reports: jobs by customer/status, truck movements, loads by carrier, material/pipe/weight, missing trucks
- Financial reports (accounting:read): revenue/profit by customer/month, AR aging, accessorials
- Customer / Carrier / Driver profile reporting snapshots
- Date presets (today → year + custom) using company timezone from Settings
- Global search: jobs, PO/refs, contacts, carriers (MC/USDOT), drivers, equipment, BOL/POD refs, invoices, settlements, filenames
- Debounced client search; server-side queries with indexes; CSV export with RBAC
- Saved-filter preparation links (My Loads Today, Missing PODs, Invoices Ready, etc.)
- Integration: `npm run test:phase7`

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
| `lib/calculations/paperwork.ts` | Checklist completeness → payment/invoice hold |
| `lib/dates/ranges.ts` | Company-timezone date presets for reports/dashboard |

Integration harnesses: `npm run test:integration`, `npm run test:phase5`, `npm run test:phase6`, `npm run test:phase7`.

---

## 9. Success Criteria for MVP

Dispatchers can:

1. Create a multi-truck oilfield job
2. Assign different cargo to each truck
3. See accurate weight totals and overweight warnings
4. Operate from Future / Today / Dispatched load board
5. Track BOL/POD per truck *(Phase 5)*
6. See job profitability and AR/AP status *(Phase 6)*
7. Get compliance and paperwork alerts *(Phase 5)*
8. Operate from a live dashboard with reports and global search *(Phase 7)*

---

## 10. Future Capabilities (architected, not built now)

Driver/customer/carrier portals, SMS/email, GPS/ELD, QuickBooks, digital signatures, OCR, geofencing, rate tables, mileage/maps — core entities must not block these.
