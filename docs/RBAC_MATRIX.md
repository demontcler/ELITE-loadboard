# RBAC permission matrix

Server-side enforcement via `requireUserPermission` / `hasPermission`. UI `Can` is convenience only.

| Permission | ADMIN | DISPATCHER | ACCOUNTING | OPERATIONS_MANAGER | VIEW_ONLY |
|---|---|---|---|---|---|
| jobs:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| jobs:write | ✓ | ✓ | | ✓ | |
| jobs:dispatch | ✓ | ✓ | | ✓ | |
| customers:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| customers:write | ✓ | ✓ | | | |
| carriers:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| carriers:write | ✓ | ✓ | | | |
| drivers:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| drivers:write | ✓ | ✓ | | | |
| equipment:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| equipment:write | ✓ | ✓ | | | |
| documents:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| documents:write | ✓ | ✓ | ✓ | | |
| accounting:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| accounting:write | ✓ | | ✓ | | |
| accounting:approve_payment | ✓ | | ✓ | | |
| reports:read | ✓ | ✓ | ✓ | ✓ | ✓ |
| settings:read | ✓ | ✓ | ✓ | ✓ | |
| settings:write | ✓ | | | | |
| users:manage | ✓ | | | | |
| audit:read | ✓ | | | ✓ | |

## Expected denials

- VIEW_ONLY: any write/dispatch/upload/payment/settings mutation → Forbidden
- DISPATCHER: cannot `accounting:write`, `accounting:approve_payment`, `settings:write`, `users:manage`
- ACCOUNTING: cannot `jobs:write`, master-data write, `users:manage`, `settings:write`
- OPERATIONS_MANAGER: read-heavy oversight; no accounting write / user admin
