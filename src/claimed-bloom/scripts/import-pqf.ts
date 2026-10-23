// Imports short quotes from the Pratchett Quote File into
// ~/.config/claimed-bloom/quotes.json for the Complain screen.
//
//   bun run import-pqf [--dry-run] [--max-length 220] [--file pqf.txt]
//
// Imported quotes are marked "source": "pqf"; a re-run replaces exactly those
// and leaves hand-written quotes and intros alone.

import bundled from "../themes/quotes.json";
import { parsePqf, PQF_URL } from "../services/pqf.ts";
import { QuoteStore, type Quote } from "../services/QuoteStore.ts";

const args = Bun.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const dryRun = args.includes("--dry-run");
const maxLength = Number(option("--max-length") ?? 220);
const file = option("--file");

if (!Number.isFinite(maxLength) || maxLength <= 0) {
  console.error("--max-length needs a positive number.");
  process.exit(1);
}

let text: string;
if (file) {
  text = await Bun.file(file).text();
} else {
  console.log(`Downloading ${PQF_URL}`);
  const response = await fetch(PQF_URL, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    console.error(`Download failed: HTTP ${response.status}. Save the file by hand and use --file.`);
    process.exit(1);
  }
  text = await response.text();
}

const imported = parsePqf(text, maxLength);
if (imported.length === 0) {
  console.error("No quotes found; is this really the PQF? Nothing was written.");
  process.exit(1);
}

const path = new QuoteStore().userPath;
const target = Bun.file(path);
let current: { intros?: unknown; quotes?: unknown; [key: string]: unknown };
if (await target.exists()) {
  try {
    current = await target.json();
  } catch {
    console.error(`${path} is not valid JSON. Fix or remove it first; nothing was written.`);
    process.exit(1);
  }
} else {
  current = { ...bundled };
}

const existing = Array.isArray(current.quotes) ? (current.quotes as Quote[]) : [];
const own = existing.filter((quote) => quote.source !== "pqf");
const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const ownTexts = new Set(own.map((quote) => normalise(quote.text ?? "")));
const added = imported.filter((quote) => !ownTexts.has(normalise(quote.text)));
const replaced = existing.length - own.length;

console.log(
  `PQF: ${imported.length} quotes of ${maxLength} characters or fewer; ` +
    `${imported.length - added.length} already among your own.`,
);
console.log(`${path}: keeping ${own.length} of your own, replacing ${replaced} earlier PQF quotes with ${added.length}.`);

if (dryRun) {
  console.log("\nDry run, nothing written. A few of them:");
  for (const quote of added.slice(0, 3)) console.log(`\n  ${quote.text}\n    — ${quote.by}`);
  process.exit(0);
}

await Bun.write(path, `${JSON.stringify({ ...current, intros: current.intros ?? bundled.intros, quotes: [...own, ...added] }, null, 2)}\n`);
console.log("Done. Open Complain to see them.");
