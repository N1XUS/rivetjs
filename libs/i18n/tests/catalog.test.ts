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
  assert.deepEqual(flatten({ cart: { title: "Cart", count: "{n}" }, ok: "OK" }), {
    "cart.title": "Cart",
    "cart.count": "{n}",
    ok: "OK",
  });
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
  assert.throws(
    () => buildTable({ ...config, missing: "fallback" }, { en: {}, de: { only: "x" }, "de-AT": {} }),
    /only: missing in default locale "en"/,
  );
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
    /c: params differ between "en" \(n\) and "de" \(count\)/,
  );
});
test("loadCatalogs reads {locale} files relative to root", async () => {
  const root = mkdtempSync(join(tmpdir(), "rivet-i18n-cat-"));
  mkdirSync(join(root, "locales"));
  writeFileSync(join(root, "locales/en.json"), JSON.stringify({ hi: "Hi" }));
  writeFileSync(join(root, "locales/de.json"), JSON.stringify({ hi: "Hallo" }));
  const { raw, files } = await loadCatalogs(
    { locales: ["en", "de"], defaultLocale: "en", catalogs: "locales/{locale}.json" },
    root,
  );
  assert.deepEqual(raw, { en: { hi: "Hi" }, de: { hi: "Hallo" } });
  assert.deepEqual(files, [join(root, "locales/en.json"), join(root, "locales/de.json")]);
});
