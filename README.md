# n8n-nodes-subscriby

**Verified community node** for [n8n](https://n8n.io/) that drives [Subscriby](https://www.subscriby.net) — subscription + access-code monetisation for Telegram communities.

Provides two nodes:

- **Subscriby Trigger** — starts a workflow when a Subscriby event fires. Covers subscriptions, payments, members, access codes, coupons, plans, projects, project resources, payment methods, bot connectivity, billing, groups, roles, teams, team members, member support conversations, saved replies and inbox settings, and message broadcasts (124 events total). Uses the `/v1/webhook-subscriptions` lifecycle and validates the `SB-Signature` HMAC on every request.
- **Subscriby** — action node for every documented route on `api.subscriby.net`. Covers 28 resources across creator-facing surfaces (projects, plans, pass windows, subscriptions, subscribers, members, broadcasts, support conversations, canned replies, support inbox settings, coupons, creator tasks, the Disaster Recovery ledger, access codes, resources, payment methods), admin surfaces (teams, team members, roles, groups, tokens, webhook endpoints, webhook deliveries, activity log), and read-only data surfaces (analytics, bot status, distribution links).

## Installation

### Community install (recommended)

Inside n8n:

1. **Settings → Community Nodes → Install**
2. Enter `n8n-nodes-subscriby`
3. Confirm and restart n8n

### Manual install (self-hosted)

```bash
cd ~/.n8n/custom
npm install n8n-nodes-subscriby
```

Restart the n8n process after install.

## Setup

1. Mint an API token at `https://app.subscriby.net/settings/tokens`. Every token is auto-bound to a team (`scope:team:<uuid>`); you pick the abilities it carries. See the [ability catalogue](https://docs.subscriby.net/api/abilities) for the full list. Minimums per use-case:
   - **Trigger node** — `webhook-endpoint:manage`. Restrict to a single project by also scoping the token to that project (`scope:project:<uuid>`).
   - **Read-only workflows** — combine `*:view` / `*:view-any` abilities for the resources you list or fetch (e.g. `project:view-any`, `project-subscription:view`, `project-subscription-plan:view`, `project-access-code:view-any`, `team-member:view-any`, `role:view`, `group:view`, `project-recovery:view-any`, `activity:read`, `dashboard:read`, `distribution:read`, `billing:read`).
   - **Write workflows** — add the matching `*:create` / `*:update` / `*:delete` abilities (e.g. `project:create`, `project-subscription-plan:update`, `project-access-code:create`, `project-resource:delete`). Cancelling a subscription is `project-subscription:update`; banning/kicking a member is `project-user:update`.
2. In n8n, **Credentials → New → Subscriby API** and paste the `sbt_...` token. Leave the base URL at the default unless you are self-hosting.
3. Add a **Subscriby Trigger** node, pick one or more events, optionally scope to a single project, and activate the workflow. On activation n8n registers the endpoint with Subscriby. Deactivating the workflow deletes the endpoint.

## Supported events (124)

The full catalogue is defined in [`nodes/SubscribyTrigger/events.ts`](nodes/SubscribyTrigger/events.ts) and mirrors the [event reference](https://docs.subscriby.net/webhooks/event-reference). This table is generated from that file by `npm run sync:readme` — do not edit it by hand.

| Family | Count | Events |
| ------ | ----- | ------ |
| Subscription | 16 | `subscription.activated`, `subscription.cancelled`, `subscription.created`, `subscription.downgraded`, `subscription.expired`, `subscription.past_due`, `subscription.paused`, `subscription.reactivated`, `subscription.refunded`, `subscription.renewed`, `subscription.trial_converting`, `subscription.trial_expired`, `subscription.trial_started`, `subscription.unpaid`, `subscription.unpaused`, `subscription.upgraded` |
| Member | 14 | `member.banned`, `member.churned`, `member.converted`, `member.identity_linked`, `member.identity_unlinked`, `member.joined`, `member.kicked`, `member.removed`, `member.resource_added`, `member.resource_pending`, `member.resource_reissued`, `member.resource_removed`, `member.trial_joined`, `member.unbanned` |
| Support | 12 | `support.canned_reply.created`, `support.canned_reply.deleted`, `support.canned_reply.updated`, `support.conversation.assigned`, `support.conversation.blocked`, `support.conversation.opened`, `support.conversation.reopened`, `support.conversation.resolved`, `support.conversation.unblocked`, `support.message.received`, `support.message.sent`, `support.settings.updated` |
| Billing | 10 | `billing.account_locked`, `billing.grace_period_warning`, `billing.invoice_created`, `billing.invoice_overdue`, `billing.invoice_paid`, `billing.payment_failed`, `billing.tier_cancelled`, `billing.tier_downgraded`, `billing.tier_upgraded`, `billing.trial_ending` |
| Pass | 8 | `pass.holder_missed`, `pass.holder_moved`, `pass.holder_queued`, `pass.holder_stranded`, `pass.window_cancelled`, `pass.window_closed`, `pass.window_opened`, `pass.window_scheduled` |
| Pass Series | 8 | `pass_series.completed`, `pass_series.leg_added`, `pass_series.leg_completed`, `pass_series.leg_dropped`, `pass_series.leg_substituted`, `pass_series.presale_opened`, `pass_series.purchased`, `pass_series.seats_exhausted` |
| Plan | 8 | `plan.activated`, `plan.created`, `plan.deactivated`, `plan.deleted`, `plan.order_changed`, `plan.sold_out`, `plan.sync_completed`, `plan.updated` |
| Project | 8 | `project.archived`, `project.bot.connected`, `project.bot.disconnected`, `project.bot.status_changed`, `project.created`, `project.deleted`, `project.restored`, `project.updated` |
| Coupon | 7 | `coupon.activated`, `coupon.created`, `coupon.deactivated`, `coupon.deleted`, `coupon.exhausted`, `coupon.redeemed`, `coupon.updated` |
| Project Resource | 6 | `project.resource.created`, `project.resource.deleted`, `project.resource.linked`, `project.resource.status_changed`, `project.resource.unlinked`, `project.resource.updated` |
| Group | 4 | `group.created`, `group.deleted`, `group.members_synced`, `group.updated` |
| Payment | 4 | `payment.failed`, `payment.pending`, `payment.refunded`, `payment.succeeded` |
| Team Member | 4 | `team.member.invited`, `team.member.joined`, `team.member.removed`, `team.member.role_changed` |
| Access Code | 3 | `access_code.expired`, `access_code.generated`, `access_code.redeemed` |
| Role | 3 | `role.created`, `role.deleted`, `role.updated` |
| Team | 3 | `team.created`, `team.deleted`, `team.updated` |
| Broadcast | 2 | `broadcast.completed`, `broadcast.queued` |
| Creator Task | 2 | `creator_task.completed`, `creator_task.opened` |
| Project Payment Method | 2 | `project.payment_method.deleted`, `project.payment_method.updated` |
| **Total** | **124** | |

## Supported actions

| Resource             | Operations                                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Project              | Create, Update, Archive, Restore, Delete, List, Get, Find by Handle                                              |
| Plan                 | Create, Update, Publish, Unpublish, Start Next Season, Arrange Storefront Order, Get, List, Delete, Find by Name |
| Pass Window          | List, Get, Create, Cancel, Remind Queue                                                                          |
| Subscription         | Cancel, Get, List, List Grants, Reissue Grants, Pause Access, Unpause Access, Reactivate, Remind Pass Holder     |
| Subscriber           | Find by Telegram ID                                                                                              |
| Member               | Ban, Unban, Kick, Get, List                                                                                      |
| Broadcast            | Send, Preview, List Audiences                                                                                    |
| Support Conversation | List, Get, List Messages, Reply, Resolve, Reopen, Assign, Block Contact, Unblock Contact                         |
| Canned Reply         | List, Get, Create, Update, Delete                                                                                |
| Support Settings     | Get, Update                                                                                                      |
| Access Code          | Bulk Generate, List, Delete, Preview                                                                             |
| Coupon               | Create, Update, Activate, Deactivate, Delete, List, Get                                                          |
| Creator Task         | List, Complete                                                                                                   |
| Recovery             | Get Readiness, List Incidents, Get Incident, List Operations, Get Operation, Get Roll Call, Get Allowances       |
| Resource             | Create, Update, Activate, Deactivate, List, Get, Unlink, Delete                                                  |
| Payment Method       | List, Get, Activate, Deactivate, Sync Plans, Delete                                                              |
| Distribution         | Get Bot Link, Get Portal URL, Get Deep Link                                                                      |
| Bot                  | Get Status, Disconnect                                                                                           |
| Analytics            | Get Dashboard, Get Earnings, Get Subscribers, Get Transaction Breakdown, Get Plan Performance, List Transactions |
| Activity             | List                                                                                                             |
| Account              | Get Me                                                                                                           |
| Team                 | Create, Update, Delete, List, Get, Get Current                                                                   |
| Team Member          | Invite, Change Role, Remove, Cancel Invitation, List, Get                                                        |
| Role                 | Create, Update, Delete, List, Get                                                                                |
| Group                | Create, Update, Sync Members, Delete, List, Get                                                                  |
| Token                | List, Get, Revoke                                                                                                |
| Webhook Endpoint     | List, Get, Create, Pause, Resume, Delete, Rotate Secret, Test                                                    |
| Webhook Delivery     | List, Get, Retry, Retry Dead                                                                                     |

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
npm link n8n-nodes-subscriby
n8n start
```

## Links

- [Subscriby documentation](https://docs.subscriby.net)
- [n8n integration guide](https://docs.subscriby.net/integrations/n8n)
- [API reference](https://docs.subscriby.net/api)
- [Event reference](https://docs.subscriby.net/webhooks/event-reference)

## License

MIT
