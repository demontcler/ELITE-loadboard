# Operations runbook

## Application unavailable

1. Check `GET /api/health`
2. Check host/platform status and recent deploy
3. Check app logs for `auth.*`, `storage.*`, database errors (JSON structured logs)
4. Roll back to last known-good deployment if needed
5. Communicate outage to dispatch/accounting leads

## Database unavailable

1. Health endpoint will show `database: error` / HTTP 503
2. Confirm managed DB status / connection limits / credentials rotation
3. Do **not** point production at staging DB
4. If restored from backup, verify document keys still resolve

## Document upload fails

1. Confirm user has `documents:write`
2. Confirm file type PDF/JPG/JPEG/PNG and size under limit
3. Check `STORAGE_PROVIDER` and bucket credentials
4. Review logs for `storage.s3_put_failed` (no secrets logged)
5. Temporary mitigation: do not enable public buckets

## User cannot login

1. Confirm user exists, `isActive=true`, not soft-deleted
2. Confirm rate limit not tripped (wait 15 minutes or restart instance to clear in-memory limiter)
3. Confirm `AUTH_SECRET` / `AUTH_URL` correct for environment
4. Reset password via admin provisioning (create/update user temporary password)
5. Deactivated users lose access within ~60 seconds of JWT revalidation

## Migration fails

1. Stop the release
2. Capture error output (no secrets)
3. Restore from pre-migration dump if DB left inconsistent
4. Fix migration in a new revision; re-test on staging
5. Never `migrate reset` in staging/production

## Storage provider unavailable

1. App can still show metadata; downloads/uploads fail
2. Queue operational notes; avoid creating invoices that depend on new POD uploads if uploads are down
3. Fail over bucket/region per provider DR plan

## Invoice / payment calculation issue

1. Do not silently rewrite paid invoices
2. Inspect Job `customerRate` vs truck allocations (revenue hierarchy)
3. Refresh invoice readiness / sync payables after paperwork changes
4. Use audit logs (`invoice.*`, `payment.*`, `payable.*`) for traceability
5. Correct with a new adjusting entry / void+recreate only with accounting approval

## Accidental record modification

1. Check audit log for actor/timestamp/before-after
2. Soft-deleted master data can often be restored by clearing `deletedAt` (admin/DB with change control)
3. Financial history: prefer compensating transactions over destructive edits

## Backup restoration required

Follow [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md). Prefer restore-to-new-instance, verify, then cutover.
