import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildTable, fallbackChain, flatten, loadCatalogs, type I18nConfig } from "../catalog.ts";

const config: I18nConfig = {
  locales: ["en", "de", "de-AT"],
  defaultLocale: "en",
  catalogs: "x",
  fallback: { "de-AT": "de" },
};

test("flatten nests with dots", () => {
  // Null-prototype result (prototype member names are plain keys): compare its own entries.
  assert.deepEqual(
    { ...flatten({ cart: { title: "Cart", count: "{n}" }, ok: "OK" }) },
    {
      "cart.title": "Cart",
      "cart.count": "{n}",
      ok: "OK",
    },
  );
});
test("flatten rejects non-string leaves", () => {
  assert.throws(() => flatten({ a: 1 }), /a: catalog values must be strings/);
});
test("fallback chain ends at default and is unique", () => {
  assert.deepEqual(fallbackChain("de-AT", config), ["de-AT", "de", "en"]);
  assert.deepEqual(fallbackChain("en", config), ["en"]);
});
test("table is indexed by locale order, falling back along the chain", () => {
  const { table } = buildTable(
    { ...config, missing: "fallback" },
    { en: { hi: "Hi", bye: "Bye" }, de: { hi: "Hallo", bye: "Tschüss" }, "de-AT": { hi: "Servus" } },
  );
  assert.deepEqual(table.hi, ["Hi", "Hallo", "Servus"]);
  assert.deepEqual(table.bye, ["Bye", "Tschüss", "Tschüss"]);
});
test("missing in default locale is always an error", () => {
  assert.throws(() => buildTable({ ...config, missing: "fallback" }, { en: {}, de: { only: "x" }, "de-AT": {} }), /only: missing in default locale "en"/);
});
test("missing policy error/warn", () => {
  const raw = { en: { hi: "Hi" }, de: {}, "de-AT": {} };
  assert.throws(() => buildTable({ ...config, missing: "error" }, raw), /hi: missing in "de"/);
  const { warnings, table } = buildTable({ ...config, missing: "warn" }, raw);
  assert.equal(warnings.length, 2);
  assert.deepEqual(table.hi, ["Hi", "Hi", "Hi"]);
});
test("param name mismatch across locales is an error", () => {
  assert.throws(
    () => buildTable(config, { en: { c: "{n} items" }, de: { c: "{count} Artikel" }, "de-AT": { c: "{n}" } }),
    /c: params differ between "en" \(n:string\) and "de" \(count:string\)/,
  );
});
test("param kind mismatch across locales is an error", () => {
  assert.throws(
    () => buildTable(config, { en: { c: "{n, number} items" }, de: { c: "{n} Artikel" }, "de-AT": { c: "{n, number}" } }),
    /c: params differ between "en" \(n:number\) and "de" \(n:string\)/,
  );
});
test("loadCatalogs reads {locale} files relative to root", async () => {
  const root = mkdtempSync(join(tmpdir(), "rivet-i18n-cat-"));
  mkdirSync(join(root, "locales"));
  writeFileSync(join(root, "locales/en.json"), JSON.stringify({ hi: "Hi" }));
  writeFileSync(join(root, "locales/de.json"), JSON.stringify({ hi: "Hallo" }));
  const { raw, files } = await loadCatalogs({ locales: ["en", "de"], defaultLocale: "en", catalogs: "locales/{locale}.json" }, root);
  assert.deepEqual(raw, { en: { hi: "Hi" }, de: { hi: "Hallo" } });
  assert.deepEqual(files, [join(root, "locales/en.json"), join(root, "locales/de.json")]);
});
// FIX-CORE (2026-11-01): catalog keys that name Object.prototype members are ordinary keys, never inherited values.
test("prototype member names are plain catalog keys", () => {
  const two: I18nConfig = { locales: ["en", "de"], defaultLocale: "en", catalogs: "x", missing: "error" };
  assert.throws(() => buildTable(two, { en: { title: "T" }, de: { title: "T", constructor: "K" } }), /constructor: missing in default locale "en"/);
  assert.throws(() => buildTable(two, { en: { title: "T", toString: "S" }, de: { title: "T" } }), /toString: missing in "de"/);
  const { table } = buildTable(two, JSON.parse('{"en":{"__proto__":"P","constructor":"C"},"de":{"__proto__":"Q","constructor":"D"}}'));
  assert.deepEqual(Object.keys(table).sort(), ["__proto__", "constructor"]);
  assert.equal(Object.getPrototypeOf(table), null);
  assert.deepEqual(Object.keys(flatten(JSON.parse('{"__proto__":{"a":"x"}}'))), ["__proto__.a"]);
});
