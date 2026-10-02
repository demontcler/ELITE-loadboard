# Phase 8 Remediation Plan

Generated from repository audit before code changes.

## CRITICAL

1. Login page pre-fills and displays seed credentials (`admin123!`) — must never ship to production UI
2. Seed script has no `APP_ENV` / production guard — can create default passwords in production
3. JWT sessions do not re-check `isActive` / `deletedAt` — deactivated users keep access until token expires
4. No production storage adapter (S3/R2) — local-only storage throws for non-local providers
5. No fail-safe when critical env vars missing in production

## HIGH

6. Auth session maxAge / cookie security not explicitly configured for production HTTPS
7. No health check endpoint
8. No deployment / backup / runbook / release documentation
9. Large list endpoints lack consistent server-side pagination
10. No ADMIN user management UI (create/deactivate/role change)
11. Paid invoice / payment immutability incomplete
12. Equipment and driver overlapping assignment warnings missing
13. Security headers not configured
14. End-to-end regression harness for paperwork→AR/AP flow incomplete as single script
15. README still prototype-oriented (phase list, seed passwords as primary setup)

## MEDIUM

16. Rate limiting abstraction for login/search/uploads
17. Structured logging + error monitoring integration point
18. Optimistic concurrency (`updatedAt`) on critical job/financial edits
19. Development load-test data generator (do not commit datasets)
20. Accessibility: ensure status text alongside color
21. Form double-submit protections review
22. Dependency audit documentation

## LOW

23. Remove module placeholders / phase language from product UI where remaining
24. Bundle cleanup / dead code
25. Browser matrix documentation (manual)

## Priority order

Security → Auth → Seed safeguards → Documents/storage → Financial immutability → RBAC/users →
Health/env → Docs → Pagination/perf → Warnings → Tests → Spec update
