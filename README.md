# n8n-nodes-memberpass

Community node for [n8n](https://n8n.io/) that drives [MemberPass](https://memberpass.net) — subscription + access-code monetisation for Telegram communities.

Provides two nodes:

- **MemberPass Trigger** — starts a workflow when a MemberPass event fires (subscriptions, payments, members, access codes, plans, projects). Uses the `/v1/webhook-subscriptions` lifecycle, validates the `MP-Signature` HMAC on every request.
- **MemberPass** — action node for every write + search route on `api.memberpass.net` (create projects, publish plans, cancel subscriptions, ban members, bulk-generate access codes, etc.).

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

1. Mint an API token at `https://app.memberpass.net/settings/tokens` with (at minimum) `team:view` + `webhook-endpoint:manage` for the trigger.
2. In n8n, **Credentials → New → MemberPass API** and paste the `mpt_...` token. Leave the base URL at the default unless you are self-hosting.
3. Add a **MemberPass Trigger** node, pick one or more events, optionally scope to a single project, and activate the workflow. On activation n8n registers the endpoint with MemberPass. Deactivating the workflow deletes the endpoint.

## Supported events (19)

| Family | Events |
| ------ | ------ |
| Subscription | `subscription.created`, `subscription.activated`, `subscription.renewed`, `subscription.cancelled`, `subscription.expired` |
| Payment | `payment.succeeded`, `payment.failed` |
| Member | `member.joined`, `member.trial_joined`, `member.banned`, `member.unbanned`, `member.kicked` |
| Access Code | `access_code.generated`, `access_code.redeemed`, `access_code.expired` |
| Plan | `plan.created`, `plan.updated`, `plan.deactivated` |
| Project | `project.created` |

## Supported actions

| Resource | Operations |
| -------- | ---------- |
| Project | Create, Update, Archive, Restore, Find by Handle |
| Plan | Create, Update, Publish, Unpublish, Get, Find by Name |
| Subscription | Cancel, Get |
| Member | Ban, Unban, Kick, Get |
| Subscriber | Find by Telegram ID |
| Access Code | Bulk Generate |
| Resource | Create |

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
