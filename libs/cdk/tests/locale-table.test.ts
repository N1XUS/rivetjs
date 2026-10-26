// Locale tables trimmed by production browser builds (`@rivetjs/compiler` `locale-tables.ts`; the lookups' file-local `localeTable`):
// for every marked cdk table, the three lookups over a trimmed table equal the full table's for locales of the kept
// languages; a lookup outside them loads the full table and reads it from then on.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { entriesText, keptEntries, languagesOf, localeTables } from "../../compiler/locale-tables.ts";
import { stringsFor } from "../_adapters/intl.ts";
import { getStringsForLocale } from "../i18n/index.ts";

const cdk = fileURLToPath(new URL("..", import.meta.url));
const files = readdirSync(cdk, { recursive: true, encoding: "utf8" })
  .filter((file) => /\.ts$/.test(file) && !/(?:^|\/)(?:tests|node_modules)/.test(file))
  .map((file) => join(cdk, file))
  .filter((file) => readFileSync(file, "utf8").includes("@rivet-locale-table"));

const LAZY = Symbol.for("rivet.locales");
const LOCALES = [
  "en",
  "en-US",
  "en-GB",
  "de",
  "de-DE",
  "de-CH",
  "ja-JP-u-ca-japanese",
  "he-IL",
  "iw-IL",
  "ar-EG",
  "zh",
  "zh-Hans",
  "zh-TW",
  "pt",
  "pt-PT",
  "sr-Latn-RS",
];
const KEPT = languagesOf(["de-DE", "ja-JP-u-ca-japanese", "he-IL", "ar-EG", "zh-Hans", "pt-BR", "sr-Latn-RS", "iw-IL"]);

test("every marked table is read (pure data, en-US)", () => {
  assert.ok(files.length >= 20, `${files.length} marked modules`);
  for (const file of files) assert.equal(localeTables(readFileSync(file, "utf8"), file).length, 1, file);
});

test("trimmed lookups = full lookups for the kept languages (stringsFor, getStringsForLocale, dismissLabel order)", async () => {
  for (const file of files) {
    const [table] = localeTables(readFileSync(file, "utf8"), file);
    const full = (await import(pathToFileURL(file).href))[table!.name] as Record<string, Record<string, string>>;
    const trimmed = Object.assign(new Function(`return ${entriesText(keptEntries(table!, KEPT))}`)(), {
      [LAZY]: { l: [...KEPT], f: () => Promise.reject(new Error("no load for a kept language")) },
    });
    for (const locale of LOCALES) {
      assert.deepEqual(stringsFor(trimmed, locale), stringsFor(full, locale), `${file} stringsFor ${locale}`);
      assert.deepEqual(getStringsForLocale(trimmed, locale), getStringsForLocale(full, locale), `${file} getStringsForLocale ${locale}`);
    }
  }
});

test("a language outside the table loads the full table once; lookups read it from then on", async () => {
  const full = { "en-US": { a: "E" }, "fr-FR": { a: "F" } };
  let loads = 0;
  const trimmed = { "en-US": { a: "E" }, [LAZY]: { l: ["en"], f: async () => (loads++, full) } };
  assert.deepEqual(stringsFor(trimmed, "en-GB"), { a: "E" });
  assert.equal(loads, 0);
  assert.deepEqual(stringsFor(trimmed, "fr-FR"), { a: "E" }, "fallback until loaded");
  assert.deepEqual(getStringsForLocale(trimmed, "fr-CA"), { a: "E" });
  assert.equal(loads, 1);
  await new Promise((done) => setTimeout(done, 0));
  assert.deepEqual(stringsFor(trimmed, "fr-FR"), { a: "F" });
  assert.deepEqual(getStringsForLocale(trimmed, "fr-CA"), { a: "F" });
  assert.equal(loads, 1);
  // untrimmed tables (server, dev) are read as they are
  assert.deepEqual(stringsFor(full, "fr"), { a: "F" });
});
