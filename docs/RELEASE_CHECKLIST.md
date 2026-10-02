# Release checklist

Use before promoting a build to staging or production.

## Code quality

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] Prisma schema validates (`npx prisma validate`)
- [ ] Migrations reviewed (`prisma/migrations/**`) — no reset scripts

## Automated tests

- [ ] `npm run test:calc`
- [ ] `npm run test:integration`
- [ ] `npm run test:phase5`
- [ ] `npm run test:phase6`
- [ ] `npm run test:phase7`
- [ ] `npm run test:phase8` (RBAC / security / e2e regression)
- [ ] `npm run test:audit`
- [ ] Dependency audit reviewed (`npm audit --omit=dev`)

## Environment

- [ ] Target `APP_ENV` set (`staging` / `production`)
- [ ] `DATABASE_URL` points to the correct isolated database
- [ ] `AUTH_SECRET` unique and ≥32 characters
- [ ] `AUTH_URL` / public URL matches HTTPS domain
- [ ] Storage provider configured; bucket private
- [ ] No production secrets in Git / CI logs
- [ ] Seed/demo scripts will not auto-run

## Data safety

- [ ] Pre-migration database backup confirmed
- [ ] Document storage versioning / backup understood
- [ ] Rollback plan written

## Security / access

- [ ] First admin bootstrapped without default passwords
- [ ] RBAC smoke: VIEW_ONLY cannot mutate; ACCOUNTING cannot manage users; DISPATCHER cannot approve payments
- [ ] Document download requires auth
- [ ] Health check does not leak secrets

## Functional smoke (staging)

- [ ] Login / logout
- [ ] Create job with 2+ trucks and different cargo
- [ ] Upload BOL/POD
- [ ] Missing POD creates invoice/payment hold; upload releases hold
- [ ] Partial customer payment updates balance
- [ ] Dashboard and search return expected records
- [ ] CSV export respects permissions

## Go / no-go

- [ ] Staging verification signed off
- [ ] Production deploy approved by owner
- [ ] On-call / rollback owner identified

**Do not deploy until this checklist is complete.**
