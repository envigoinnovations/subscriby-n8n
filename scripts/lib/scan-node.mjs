/**
 * What this package offers, read from its source files.
 *
 * One scan feeds two consumers: `verify-surface.mjs`, which compares it with
 * the catalogues Subscriby exports, and `export-operations.mjs`, which hands
 * it to the docs site so the n8n page lists what exists rather than what
 * someone typed. The action node declares its resources in the `resource`
 * options and, per resource, an `Operation` options property whose entries
 * carry the operation's `name`, `value`, `action` and `description`; the
 * trigger node's `events.ts` is the event catalogue. Both are read as text,
 * the way `sync-readme-events.js` already reads the catalogue, so no build is
 * needed to answer.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** The `{ ... }` entries of one options array, each reduced to its quoted properties. */
function entriesOf(block) {
  const entries = [];
  for (const entry of block.matchAll(/\{([^{}]*)\}/g)) {
    const properties = {};
    for (const property of entry[1].matchAll(/\b(name|value|action|description):\s*(['"])((?:(?!\2)[^\\]|\\.)*)\2/g)) {
      properties[property[1]] = property[3].replace(/\\(['"])/g, "$1");
    }
    if (properties.value !== undefined) {
      entries.push(properties);
    }
  }
  return entries;
}

/**
 * The action node's resources with their operations, in the order the node lists them.
 */
export function scanResources(nodeFile) {
  const source = readFileSync(nodeFile, "utf8");

  const resourceBlock = /name:\s*'resource',[\s\S]*?options:\s*\[([\s\S]*?)\n\s*\],/.exec(source);
  if (!resourceBlock) {
    throw new Error(`No resource options found in ${nodeFile}.`);
  }

  const operationsByResource = new Map();
  const operationBlocks = source.matchAll(
    /displayName:\s*'Operation',\s*name:\s*'operation',\s*type:\s*'options',\s*noDataExpression:\s*true,\s*displayOptions:\s*\{\s*show:\s*\{\s*resource:\s*\['([A-Za-z]+)'\]\s*\}\s*\},\s*options:\s*\[([\s\S]*?)\n\s*\],/g,
  );
  for (const block of operationBlocks) {
    operationsByResource.set(block[1], entriesOf(block[2]));
  }

  return entriesOf(resourceBlock[1]).map((resource) => ({
    key: resource.value,
    name: resource.name,
    operations: operationsByResource.get(resource.value) ?? [],
  }));
}

/** The trigger node's event catalogue, in file order. */
export function scanEvents(eventsFile) {
  const source = readFileSync(eventsFile, "utf8");
  return [...source.matchAll(/\{ family: '([^']+)', name: '([^']+)', value: '([^']+)' \}/g)].map(([, family, name, value]) => ({
    family,
    name,
    value,
  }));
}

/** Everything the docs site needs about this package. */
export function scanNode(root) {
  return {
    resources: scanResources(join(root, "nodes", "Subscriby", "Subscriby.node.ts")),
    events: scanEvents(join(root, "nodes", "SubscribyTrigger", "events.ts")),
  };
}
