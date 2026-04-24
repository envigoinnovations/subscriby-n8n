# n8n-nodes-memberpass

Community node for [n8n](https://n8n.io/) that drives [MemberPass](https://www.memberpass.net) — subscription + access-code monetisation for Telegram communities.

Provides two nodes:

- **MemberPass Trigger** — starts a workflow when a MemberPass event fires. Covers subscriptions, payments, members, access codes, plans, projects, project resources, bot connectivity, billing, groups, roles, teams, and team members (71 events total). Uses the `/v1/webhook-subscriptions` lifecycle and validates the `MP-Signature` HMAC on every request.
- **MemberPass** — action node for every documented route on `api.memberpass.net`. Covers 19 resources across creator-facing surfaces (projects, plans, subscriptions, subscribers, members, access codes, resources, payment methods), admin surfaces (teams, team members, roles, groups, tokens, webhook endpoints, webhook deliveries, activity log), and read-only data surfaces (analytics, bot status, distribution links).

## Installation

### Community install (recommended)

Inside n8n:

1. **Settings → Community Nodes → Install**
2. Enter `n8n-nodes-memberpass`
3. Agree to the community-node warning and restart n8n

### Manual install (self-hosted)

```bash
cd ~/.n8n/custom
npm install n8n-nodes-memberpass
```

Restart the n8n process after install.

## Setup

1. Mint an API token at `https://app.memberpass.net/settings/tokens`. Every token is auto-bound to a team (`scope:team:<uuid>`); you pick the abilities it carries. See the [ability catalogue](https://docs.memberpass.net/api/abilities) for the full list. Minimums per use-case:
   - **Trigger node** — `webhook-endpoint:manage`. Restrict to a single project by also scoping the token to that project (`scope:project:<uuid>`).
   - **Read-only workflows** — combine `*:view` / `*:view-any` abilities for the resources you list or fetch (e.g. `project:view-any`, `project-subscription:view`, `project-subscription-plan:view`, `project-access-code:view-any`, `team-member:view-any`, `role:view`, `group:view`, `activity:read`, `dashboard:read`, `distribution:read`, `billing:read`).
   - **Write workflows** — add the matching `*:create` / `*:update` / `*:delete` abilities (e.g. `project:create`, `project-subscription-plan:update`, `project-access-code:create`, `project-resource:delete`). Cancelling a subscription is `project-subscription:update`; banning/kicking a member is `project-user:update`.
2. In n8n, **Credentials → New → MemberPass API** and paste the `mpt_...` token. Leave the base URL at the default unless you are self-hosting.
3. Add a **MemberPass Trigger** node, pick one or more events, optionally scope to a single project, and activate the workflow. On activation n8n registers the endpoint with MemberPass. Deactivating the workflow deletes the endpoint.

## Supported events (71)

The full catalogue is defined in [`nodes/MemberPassTrigger/events.ts`](nodes/MemberPassTrigger/events.ts) and mirrors the [event reference](https://docs.memberpass.net/webhooks/event-reference).

| Family           | Count | Events                                                                                                                                                                                                                                                                                                 |
| ---------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Subscription     | 16    | `subscription.created`, `subscription.activated`, `subscription.renewed`, `subscription.cancelled`, `subscription.expired`, `subscription.downgraded`, `subscription.upgraded`, `subscription.past_due`, `subscription.unpaid`, `subscription.paused`, `subscription.unpaused`, `subscription.reactivated`, `subscription.refunded`, `subscription.trial_started`, `subscription.trial_converting`, `subscription.trial_expired` |
| Payment          | 4     | `payment.succeeded`, `payment.failed`, `payment.pending`, `payment.refunded`                                                                                                                                                                                                                           |
| Member           | 10    | `member.joined`, `member.trial_joined`, `member.banned`, `member.unbanned`, `member.kicked`, `member.removed`, `member.churned`, `member.converted`, `member.resource_added`, `member.resource_removed`                                                                                                |
| Access Code      | 3     | `access_code.generated`, `access_code.redeemed`, `access_code.expired`                                                                                                                                                                                                                                 |
| Plan             | 6     | `plan.created`, `plan.updated`, `plan.activated`, `plan.deactivated`, `plan.deleted`, `plan.sync_completed`                                                                                                                                                                                            |
| Project          | 7     | `project.created`, `project.updated`, `project.archived`, `project.restored`, `project.deleted`, `project.bot.connected`, `project.bot.disconnected`                                                                                                                                                   |
| Project Resource | 4     | `project.resource.created`, `project.resource.linked`, `project.resource.unlinked`, `project.resource.deleted`                                                                                                                                                                                         |
| Billing          | 9     | `billing.invoice_created`, `billing.invoice_paid`, `billing.invoice_overdue`, `billing.payment_failed`, `billing.grace_period_warning`, `billing.account_locked`, `billing.tier_upgraded`, `billing.tier_downgraded`, `billing.tier_cancelled`                                                          |
| Group            | 3     | `group.created`, `group.updated`, `group.deleted`                                                                                                                                                                                                                                                      |
| Role             | 3     | `role.created`, `role.updated`, `role.deleted`                                                                                                                                                                                                                                                         |
| Team             | 2     | `team.created`, `team.deleted`                                                                                                                                                                                                                                                                         |
| Team Member      | 4     | `team.member.invited`, `team.member.joined`, `team.member.removed`, `team.member.role_changed`                                                                                                                                                                                                         |

## Supported actions

| Resource         | Operations                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| Project          | Create, Update, Archive, Restore, Delete, List, Get, Find by Handle                                                 |
| Plan             | Create, Update, Publish, Unpublish, Get, List, Delete, Find by Name                                                 |
| Subscription     | Cancel, Get, List                                                                                                   |
| Subscriber       | Find by Telegram ID                                                                                                 |
| Member           | Ban, Unban, Kick, Get, List                                                                                         |
| Access Code      | Bulk Generate, List, Delete, Preview                                                                                |
| Resource         | Create, List, Get, Unlink, Delete                                                                                   |
| Payment Method   | List, Get                                                                                                           |
| Distribution     | Get Bot Link, Get Portal URL, Get Deep Link                                                                         |
| Bot              | Get Status                                                                                                          |
| Analytics        | Get Dashboard, Get Earnings, Get Subscribers, Get Transaction Breakdown, Get Plan Performance, List Transactions    |
| Activity         | List                                                                                                                |
| Team             | List, Get, Get Current                                                                                              |
| Team Member      | List, Get                                                                                                           |
| Role             | List, Get                                                                                                           |
| Group            | List, Get                                                                                                           |
| Token            | List, Get, Revoke                                                                                                   |
| Webhook Endpoint | List, Create, Delete, Rotate Secret, Test                                                                           |
| Webhook Delivery | List                                                                                                                |

Every mutation automatically sends a fresh `Idempotency-Key` header so node re-runs never double-fire.

## Development

```bash
npm install
npm run build    # compile TS + copy icons
npm run dev      # watch mode
npm run lint
```

To test against a local n8n:

```bash
npm link
cd ~/.n8n/custom
npm link n8n-nodes-memberpass
n8n start
```

## Links

- [MemberPass documentation](https://docs.memberpass.net)
- [n8n integration guide](https://docs.memberpass.net/integrations/n8n)
- [API reference](https://docs.memberpass.net/api)
- [Event reference](https://docs.memberpass.net/webhooks/event-reference)

## License

MIT
