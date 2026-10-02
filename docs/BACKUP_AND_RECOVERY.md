# Database / document backup and recovery

## Scope

ELITE Loadboard stores:

1. **PostgreSQL** — operational, compliance metadata, accounting, audit logs
2. **Private document storage** — BOL/POD/PDFs/images (local filesystem in development; S3-compatible object storage in staging/production)

A backup is incomplete unless **restore** is practiced.

---

## Environments

| Environment | Database | Documents |
|---|---|---|
| Local | Developer Postgres | `./storage` (gitignored) |
| Staging | Dedicated staging DB | Dedicated staging bucket |
| Production | Dedicated production DB | Dedicated production bucket |

Never restore production backups into production without a change ticket and verification plan.

---

## Database backups (production)

### Automated

Use the managed Postgres provider’s automated backups:

- Daily full backups (minimum)
- Point-in-time recovery (PITR) if the provider supports WAL archiving
- Retention: recommend **30 days** minimum for production

### Manual pre-migration backup

Before every production migration:

```bash
# Example — adjust for your host
pg_dump "$DATABASE_URL" --format=custom --file="elite-pre-migrate-$(date -u +%Y%m%dT%H%M%SZ).dump"
```

Store the dump in an access-controlled location **outside** the application server.

### Restore (logical dump)

```bash
# WARNING: destructive to target database contents
pg_restore --clean --if-exists --no-owner --dbname="$DATABASE_URL" elite-pre-migrate-....dump
```

For managed PITR, follow the provider’s console restore-to-timestamp procedure into a **new** instance first, verify, then cutover if appropriate.

---

## Document storage backups

### Local development

`./storage` is ephemeral for developers. Do not rely on it for recovery testing beyond local demos.

### Staging / production object storage

Configure the bucket with:

- **Private ACL** (no public reads)
- **Versioning** enabled (recommended)
- **Object lock / retention** where available for compliance docs
- Cross-region replication optional for disaster recovery

Backup strategy:

1. Rely on provider durability + versioning for accidental overwrite protection
2. Periodic inventory / sync of object keys to cold storage if required by company policy
3. Keep DB backups and object storage in sync — document `filePath` keys in Postgres must resolve after restore

### Restore documents

1. Restore database to a point in time
2. Ensure object storage still contains the referenced keys (or restore versions)
3. Verify a sample of BOL/POD downloads through `/api/documents/...` (authenticated)

---

## Disaster scenarios

| Scenario | Response |
|---|---|
| App server down | Redeploy app; DB/storage unaffected |
| DB corruption | PITR or restore latest verified dump to new instance; cutover DNS/app config |
| Accidental document delete | Restore object version; confirm DB `filePath` |
| Region outage | Fail over to replica / secondary region per hosting plan |
| Bad migration | Restore pre-migration dump; fix migration; re-deploy |

---

## Migration rollback considerations

- Prefer **forward fixes** for Prisma migrations already applied in production
- Keep the pre-migration `pg_dump` until the release is confirmed stable
- Never run `prisma migrate reset` in staging/production
- Production migrate command: `npx prisma migrate deploy`

---

## Restore drill checklist (do this in staging)

1. Take staging backup
2. Restore into a throwaway database
3. Point a temporary app instance at it
4. Login as staging admin
5. Open a job, download a document, open an invoice
6. Record time-to-recover

Schedule drills at least quarterly.
