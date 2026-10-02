# Deferred dependency upgrades (Phase 8)

`npm audit --omit=dev` (as of Phase 8 completion) reported high findings in transitive dependencies:

1. **deepmerge-ts** via `prisma` / `@prisma/config` — fix requires Prisma major/minor jump that may be breaking
2. **postcss** via `next` — fix path wants Next.js 16 via `npm audit fix --force`

**Decision:** Do **not** force-upgrade Next or Prisma during Phase 8. These are transitive build/tooling issues, not directly exploitable application input paths for our credentials/login/document flows. Track for a controlled upgrade window after staging soak.

Re-run: `npm run audit:deps`
