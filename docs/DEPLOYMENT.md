# Deployment guide (local → staging → production)

**Do not deploy until manually approved.** This document prepares the application to be deployable.

## Architecture (recommended)

```
Internet users
    ↓ HTTPS
Next.js host (Node 20+)
    ↓
Managed PostgreSQL  (separate DB per environment)
    +
Private S3-compatible object storage (separate bucket per environment)
```

Portable across common hosts (Vercel/Render/Fly/VM + reverse proxy). Do not hard-code a single vendor in application logic.

---

## Environments

| | Local | Staging | Production |
|---|---|---|---|
| `APP_ENV` | `local` / `development` | `staging` | `production` |
| Database | local Postgres | staging DB | production DB |
| Storage | `STORAGE_PROVIDER=local` | `s3` (staging bucket) | `s3` (prod bucket) |
| Auth secret | dev-only | unique staging secret | unique production secret |
| Seed | allowed | only with `ALLOW_STAGING_SEED=true` | **blocked** (use bootstrap-admin) |
| Domain | localhost:3000 | staging.example.com | loadboard.example.com |

Environment data must never cross boundaries.

---

## Required environment variable NAMES

See root `.env.example` for the full list. Critical names:

- `APP_ENV`
- `DATABASE_URL`
- `AUTH_SECRET`
- `AUTH_URL` / `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL`
- `AUTH_TRUST_HOST`
- `STORAGE_PROVIDER` (`local` | `s3` | `r2` | `minio`)
- `STORAGE_LOCAL_PATH` (local only)
- `STORAGE_BUCKET` / `STORAGE_REGION` / `STORAGE_ENDPOINT`
- `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY`
- `MAX_UPLOAD_SIZE_BYTES`
- `ALLOW_LOCAL_STORAGE_IN_PRODUCTION` (emergency only)
- `ALLOW_PRODUCTION_SEED` / `ALLOW_STAGING_SEED` (explicit overrides)
- `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` (bootstrap script)

Never commit real values.

---

## Local setup

```bash
cp .env.example .env
# set DATABASE_URL + AUTH_SECRET
npm install
npx prisma migrate dev
npm run db:seed          # development only
npm run dev
```

Health: `GET http://localhost:3000/api/health`

---

## Database migrations

| Environment | Command |
|---|---|
| Local/dev | `npx prisma migrate dev` |
| Staging/Production | `npx prisma migrate deploy` |

**Forbidden in staging/production:**

- `prisma migrate reset`
- `prisma db push` as the primary migration path
- Seeding demo customers/jobs

Always take a DB backup before production `migrate deploy`.

---

## Storage setup

1. Create a **private** bucket (block public access)
2. Create an IAM user/key limited to that bucket
3. Set `STORAGE_PROVIDER=s3` and credentials
4. Install AWS SDK in the deployment image: `npm i @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
5. Verify upload + authenticated download in staging

Documents are served only through authenticated `/api/documents/[ownerType]/[id]` — not public object URLs.

---

## Authentication setup

1. Generate `AUTH_SECRET`: `openssl rand -base64 32`
2. Set `AUTH_URL` to the public HTTPS origin
3. Create the first admin with `scripts/bootstrap-admin.ts` (not default passwords)
4. Manage additional users in **Settings → Users**

---

## First production admin

```bash
APP_ENV=production \
BOOTSTRAP_ADMIN_EMAIL='you@company.com' \
BOOTSTRAP_ADMIN_PASSWORD='long-random-password' \
npx tsx scripts/bootstrap-admin.ts
```

Then sign in and immediately rotate if the password was shared via chat.

---

## HTTPS / domain

- Terminate TLS at the load balancer / platform
- HSTS is enabled when `APP_ENV` is staging/production
- Set DNS only after staging validation

---

## Health checks

`GET /api/health` returns `{ status, application, database }` without secrets.

Use it for load balancer readiness/liveness.

---

## Rollback strategy

1. Keep previous app deployment artifact
2. Keep pre-migration database dump
3. If release fails: redeploy previous app revision; restore DB only if migration is unsafe to leave applied
4. Prefer forward-fix migrations when possible

See also: [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md), [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).
