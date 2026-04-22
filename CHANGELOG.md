# Changelog

## 1.1.0 — 2026-04-23

Full-parity sync with the live MemberPass REST + webhook surface.

### Trigger node

- Event options expanded from 19 to **71** — every event in the `WebhookEvent` catalog. New families: `project.resource.*`, `team.*`, `role.*`, `group.*`, `billing.*`, plus additional `project.*`, `plan.*`, `subscription.*`, `payment.*`, `member.*` transitions.

### Action node — new resources

- `paymentMethod` — list, get
- `webhookEndpoint` — list, create, delete, rotateSecret, test
- `webhookDelivery` — list (by event type)
- `token` — list, get, revoke
- `team` — list, get, getCurrent
- `teamMember` — list, get
- `role` — list, get
- `group` — list, get
- `activity` — list (by subject)
- `bot` — getStatus
- `distribution` — getBotLink, getPortalUrl, getDeepLink
- `analytics` — getDashboard, getEarnings, getSubscribers, getTransactions, getTransactionBreakdown, getPlanPerformance, listTransactions

### Action node — operations added to existing resources

- `project`: `list`, `get`, `delete`
- `plan`: `list`, `delete`
- `subscription`: `list`
- `member`: `list`
- `accessCode`: `list`, `delete`, `preview`
- `resource`: `list`, `get`, `unlink`, `delete`

### Credential

- Placeholder updated to `mpt_live_<id>_<secret>` (Stripe-style token format). Description explains the `mpt_live_` / `mpt_test_` split.

### Backwards compatibility

No breaking changes. Every resource, operation, trigger event, and parameter from 1.0.0 is preserved — existing workflows keep working.

## 1.0.0

Initial release to npm.
