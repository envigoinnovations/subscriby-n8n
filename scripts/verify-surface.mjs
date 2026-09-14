#!/usr/bin/env node
/**
 * Fails the build when the Subscriby API has an endpoint this node offers no
 * operation for, or a webhook event the trigger node cannot subscribe to.
 *
 * Decision 25 of the Connectors program made surface parity a gate: every
 * creator operation lands on the dashboard, REST, MCP, the webhooks, Zapier
 * and n8n in one pass. The Subscriby suite holds the REST and MCP halves
 * (SurfaceParityTest); this script holds this package's half against the same
 * exports, so an endpoint or an event added in Subscriby cannot ship without
 * its n8n counterpart.
 *
 * scripts/data/api-endpoints.json and scripts/data/webhook-events.json are the
 * answer, refreshed from the Subscriby repo with:
 *
 *   php artisan subscriby:docs:export-metadata --docs
 *
 * Endpoints that deliberately have no operation are listed below with their
 * reason; an entry whose endpoint gains an operation fails as stale, so the
 * list only shrinks. A handful of call sites build their path through a
 * variable or a lookup table rather than a literal; those are spelt out in
 * INDIRECT_OPERATIONS so the check stays honest without rewriting the node.
 * When the docs repo is checked out beside this one, its copy of this
 * package's resources and events (`npm run export:operations`) must match the
 * source too, or the n8n docs page would be generated from yesterday's node.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { scanNode } from "./lib/scan-node.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dataDir = join(root, "scripts/data");
const nodesDir = join(root, "nodes");
const docsCopy = join(root, "..", "SubscribyDocs", "scripts", "data", "n8n-operations.json");

/**
 * Endpoints this package deliberately offers no operation for.
 *
 * Keyed `METHOD /path` with `{}` standing for every path parameter, exactly as
 * the checks below spell them, each with the reason it stays off n8n.
 */
const DELIBERATELY_ABSENT = new Map([
  ["GET /me/alert-destinations", "Where a creator's own alerts go is set on the dashboard or in the apps; Account › Get Me reads it."],
  ["PUT /me/alert-destinations", "Where a creator's own alerts go is set on the dashboard or in the apps; Account › Get Me reads it."],
  ["GET /me/identities", "The creator's own linked accounts are account security, managed in person."],
  ["DELETE /me/identities/{}", "The creator's own linked accounts are account security, managed in person."],
  ["GET /me/recovery", "Relinking the creator's own account is a human act at the connector; the dashboard's recovery steps drive it."],
  ["POST /me/recovery/backup-identity", "Relinking the creator's own account is a human act at the connector; the dashboard's recovery steps drive it."],
  ["POST /me/recovery/backup-identity/switch", "Relinking the creator's own account is a human act at the connector; the dashboard's recovery steps drive it."],
  ["DELETE /me/recovery/backup-identity", "Relinking the creator's own account is a human act at the connector; the dashboard's recovery steps drive it."],
  ["POST /me/recovery/handshakes", "Relinking the creator's own account is a human act at the connector; the dashboard's recovery steps drive it."],
  ["GET /me/recovery/handshakes/{}", "Relinking the creator's own account is a human act at the connector; the dashboard's recovery steps drive it."],
  ["DELETE /me/recovery/handshakes/{}", "Relinking the creator's own account is a human act at the connector; the dashboard's recovery steps drive it."],
  ["POST /me/recovery/handshakes/{}/confirm", "Relinking the creator's own account is a human act at the connector; the dashboard's recovery steps drive it."],
  ["GET /ping", "The health probe, not an operation."],
  ["GET /projects/{}/recovery/members/export", "A CSV download; a node output is JSON items, not a file stream."],
  ["POST /tokens", "Minting API tokens is the creator's act on the dashboard; a token never mints tokens."],
  ["GET /webhook-events", "The trigger node ships the catalogue in events.ts, which this script checks against the export."],
  ["GET /webhook-subscriptions", "Bookkeeping of the trigger node's own subscriptions; it subscribes and unsubscribes without listing."],
]);

/**
 * Operations whose path the node assembles from a variable or a table, so a
 * literal scan cannot see them. Each names the call site it stands for.
 */
const INDIRECT_OPERATIONS = new Map([
  ["GET /projects/{}/connectors/{}/installation", "connector: installationPath variable"],
  ["POST /projects/{}/connectors/{}/installation/verify", "connector: installationPath variable"],
  ["POST /projects/{}/connectors/{}/installation/doctor", "connector: installationPath variable"],
  ["POST /projects/{}/connectors/{}/installation/restore-access", "connector: installationPath variable"],
  ["PATCH /projects/{}/connectors/{}/installation/settings", "connector: installationPath variable"],
  ["DELETE /projects/{}/connectors/{}/installation", "connector: installationPath variable"],
  ["GET /projects/{}/connectors/{}/uninstall-preview", "connector: installationPath variable"],
  ["POST /projects/{}/coupons/{}/activate", "coupon: the verb is the operation name"],
  ["POST /projects/{}/coupons/{}/deactivate", "coupon: the verb is the operation name"],
  ["POST /projects/{}/members/{}/ban", "member: the verb is the operation name"],
  ["POST /projects/{}/members/{}/kick", "member: the verb is the operation name"],
  ["POST /projects/{}/pass-windows/{}/cancel", "passWindow: verb chosen from the operation"],
  ["POST /projects/{}/pass-windows/{}/remind", "passWindow: verb chosen from the operation"],
  ["POST /projects/{}/payment-methods/{}/activate", "paymentMethod: the verb is the operation name"],
  ["POST /projects/{}/payment-methods/{}/deactivate", "paymentMethod: the verb is the operation name"],
  ["POST /projects/{}/payment-methods/{}/sync", "paymentMethod: the verb is the operation name"],
  ["POST /projects/{}/plans/{}/publish", "plan: the verb is the operation name"],
  ["POST /projects/{}/plans/{}/unpublish", "plan: the verb is the operation name"],
  ["POST /projects/{}/resources/{}/activate", "resource: the verb is the operation name"],
  ["POST /projects/{}/resources/{}/deactivate", "resource: the verb is the operation name"],
  ["GET /projects/{}/resources/{}/standby", "recovery: resourceOperations table"],
  ["POST /projects/{}/resources/{}/standby/request", "recovery: resourceOperations table"],
  ["DELETE /projects/{}/resources/{}/standby/request", "recovery: resourceOperations table"],
  ["POST /projects/{}/resources/{}/standby/use", "recovery: resourceOperations table"],
  ["DELETE /projects/{}/resources/{}/standby", "recovery: resourceOperations table"],
  ["POST /projects/{}/resources/{}/replacement/request", "recovery: resourceOperations table"],
  ["DELETE /projects/{}/resources/{}/replacement/request", "recovery: resourceOperations table"],
  ["GET /recovery/operations/{}", "recovery: getOperation and rollCall share a call with a suffix"],
  ["GET /recovery/operations/{}/roll-call", "recovery: getOperation and rollCall share a call with a suffix"],
  ["POST /recovery/operations/{}/nudge", "recovery: verb chosen from the operation"],
  ["POST /recovery/operations/{}/notify-members", "recovery: verb chosen from the operation"],
  ["POST /subscriptions/{}/pause", "subscription: the verb is the operation name"],
  ["POST /subscriptions/{}/unpause", "subscription: the verb is the operation name"],
  ["POST /subscriptions/{}/reactivate", "subscription: the verb is the operation name"],
  ["POST /subscriptions/{}/remind", "subscription: the verb is the operation name"],
  ["POST /support/conversations/{}/resolve", "supportConversation: the verb is the operation name"],
  ["POST /support/conversations/{}/reopen", "supportConversation: the verb is the operation name"],
  ["POST /support/conversations/{}/block", "supportConversation: the verb is the operation name"],
  ["POST /support/conversations/{}/unblock", "supportConversation: the verb is the operation name"],
  ["POST /webhook-endpoints/{}/pause", "webhookEndpoint: the verb is the operation name"],
  ["POST /webhook-endpoints/{}/resume", "webhookEndpoint: the verb is the operation name"],
]);

function fail(message) {
  console.error(`\nverify-surface: ${message}\n`);
  process.exit(1);
}

function readCatalog(name) {
  const file = join(dataDir, name);
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    fail(
      `Missing ${relative(root, file)}.\n` +
        "Regenerate it from the Subscriby repo:\n" +
        "  php artisan subscriby:docs:export-metadata --docs",
    );
  }
  return JSON.parse(raw).items;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (full.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

/** `/api/v1/projects/{project}/members/{member}` → `/projects/{}/members/{}`. */
function normaliseExported(uri) {
  return uri.replace(/^\/api\/v1/, "").replace(/\{[^}]+\}/g, "{}");
}

/** `/projects/${projectId}/members?status=x` → `/projects/{}/members`. */
function normaliseSource(template) {
  return template
    .replace(/\$\{[^}]*\}/g, "{}")
    .replace(/\?.*$/, "")
    .replace(/\/$/, "");
}

/** Every `METHOD /path` a source file passes to subscribyApiRequest with a literal method and path. */
function operationsIn(source) {
  const found = new Set();
  const calls = source.matchAll(
    /subscribyApiRequest(?:AllItems)?\.call\(\s*this,\s*['"]([A-Z]+)['"],\s*(?:`([^`]*)`|'([^']*)')/g,
  );
  for (const call of calls) {
    const path = normaliseSource(call[2] ?? call[3]);
    if (path.startsWith("/")) {
      found.add(`${call[1]} ${path}`);
    }
  }
  return found;
}

const offered = new Set(INDIRECT_OPERATIONS.keys());
for (const file of walk(nodesDir)) {
  for (const operation of operationsIn(readFileSync(file, "utf8"))) {
    offered.add(operation);
  }
}

const scanned = scanNode(root);
const catalogued = new Set(scanned.events.map((event) => event.value));

const problems = [];

const endpoints = readCatalog("api-endpoints.json");
for (const endpoint of endpoints) {
  const key = `${endpoint.method} ${normaliseExported(endpoint.uri)}`;
  const covered = offered.has(key);
  const excused = DELIBERATELY_ABSENT.has(key);
  if (!covered && !excused) {
    problems.push(`no operation for ${key} (${endpoint.name})`);
  }
  if (covered && excused) {
    problems.push(`stale exception: ${key} now has an operation; remove it from DELIBERATELY_ABSENT`);
  }
}
const exported = new Set(endpoints.map((endpoint) => `${endpoint.method} ${normaliseExported(endpoint.uri)}`));
for (const key of [...DELIBERATELY_ABSENT.keys(), ...INDIRECT_OPERATIONS.keys()]) {
  if (!exported.has(key)) {
    problems.push(`stale entry: ${key} is no longer an endpoint; remove it`);
  }
}

const events = readCatalog("webhook-events.json");
const eventNames = new Set(events.map((event) => event.name));
for (const name of eventNames) {
  if (!catalogued.has(name)) {
    problems.push(`no trigger event for ${name} in nodes/SubscribyTrigger/events.ts`);
  }
}
for (const name of catalogued) {
  if (!eventNames.has(name)) {
    problems.push(`events.ts lists ${name}, which is not an event Subscriby emits`);
  }
}

if (existsSync(docsCopy) && readFileSync(docsCopy, "utf8").trim() !== JSON.stringify(scanned, null, 2)) {
  problems.push("the docs repo's copy of this package's resources and events is behind the source; run: npm run export:operations");
}

if (problems.length > 0) {
  fail(`${problems.length} surface gap(s):\n  - ${problems.join("\n  - ")}`);
}

console.log(
  `verify-surface: ${endpoints.length} endpoints (${DELIBERATELY_ABSENT.size} deliberately absent) and ${eventNames.size} events all have an n8n counterpart; ${scanned.resources.length} resources scanned.`,
);
