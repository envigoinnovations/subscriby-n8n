/**
 * Regenerate the README's supported-events table from the event catalogue.
 *
 * `nodes/SubscribyTrigger/events.ts` is the single source of truth, and it says
 * so in its own header — but the README table beside it was hand-maintained and
 * drifted anyway, at one point listing two events in the `pass` family when
 * there were eight. Generating it removes the opportunity.
 *
 * Run with `npm run sync:readme`. It rewrites the "## Supported events" heading,
 * the table, and the count in the intro paragraph, and leaves everything else
 * alone.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const eventsFile = path.join(root, "nodes", "SubscribyTrigger", "events.ts");
const readmeFile = path.join(root, "README.md");

const source = fs.readFileSync(eventsFile, "utf8");

const entries = [...source.matchAll(/\{ family: '([^']+)', name: '[^']+', value: '([^']+)' \}/g)].map(
  ([, family, value]) => ({ family, value }),
);

if (entries.length === 0) {
  console.error("No events parsed from events.ts — refusing to write an empty table.");
  process.exit(1);
}

const byFamily = new Map();

for (const { family, value } of entries) {
  if (!byFamily.has(family)) {
    byFamily.set(family, []);
  }
  byFamily.get(family).push(value);
}

const rows = [...byFamily.entries()]
  .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "en"))
  .map(([family, values]) => {
    const list = values.map((v) => `\`${v}\``).join(", ");
    return `| ${family} | ${values.length} | ${list} |`;
  });

const table = [
  "| Family | Count | Events |",
  "| ------ | ----- | ------ |",
  ...rows,
  `| **Total** | **${entries.length}** | |`,
].join("\n");

let readme = fs.readFileSync(readmeFile, "utf8");

const headingAt = readme.indexOf("## Supported events");
const nextHeadingAt = readme.indexOf("\n## ", headingAt + 1);

if (headingAt === -1 || nextHeadingAt === -1) {
  console.error("Could not locate the '## Supported events' section in README.md.");
  process.exit(1);
}

const section = `## Supported events (${entries.length})

The full catalogue is defined in [\`nodes/SubscribyTrigger/events.ts\`](nodes/SubscribyTrigger/events.ts) and mirrors the [event reference](https://docs.subscriby.net/webhooks/event-reference). This table is generated from that file by \`npm run sync:readme\` — do not edit it by hand.

${table}
`;

readme = readme.slice(0, headingAt) + section + readme.slice(nextHeadingAt);

readme = readme.replace(
  /\(\d+ events total\)/,
  `(${entries.length} events total)`,
);

fs.writeFileSync(readmeFile, readme, "utf8");

console.log(`README events table synced: ${entries.length} events across ${byFamily.size} families.`);
