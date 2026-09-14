#!/usr/bin/env node
/**
 * Hand the docs site what this package offers, so its n8n page is generated
 * rather than typed.
 *
 * Writes `scripts/data/n8n-operations.json` into the sibling SubscribyDocs
 * checkout, where `scripts/generate-integration-pages.mjs` turns it into the
 * event table and the resource matrix of `content/integrations/n8n.mdx` on
 * every build. Run it after adding, renaming or removing a resource, an
 * operation or an event:
 *
 *   npm run export:operations
 *
 * `verify-surface.mjs` fails the build while the docs copy is behind the
 * source, so forgetting this step is caught rather than published.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanNode } from "./lib/scan-node.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const target = join(root, "..", "SubscribyDocs", "scripts", "data", "n8n-operations.json");

if (!existsSync(dirname(target))) {
  console.error(`export-operations: SubscribyDocs is not checked out beside this repo (looked for ${dirname(target)}).`);
  process.exit(1);
}

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(scanNode(root), null, 2)}\n`);
console.log(`export-operations: wrote ${target}`);
