// API page URLs stay unique ignoring letter case (`codeInfo` / `CodeInfo` = one file on macOS, Windows
// and case-insensitive hosts): `tools/api.ts` `assignHrefs`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assignHrefs, type ApiModel, type ApiSymbol } from "../tools/api.ts";

const symbol = (entry: string, name: string, kind: string): ApiSymbol => ({
  key: `${entry}#${name}`,
  entry,
  name,
  kind,
  summary: "",
  remarks: "",
  signatures: [],
  params: [],
  members: [],
  runsOn: "both",
  status: "stable",
  examples: [],
  source: { file: "", line: 1, url: "" },
  href: "",
});
const model = (symbols: ApiSymbol[], entries = ["@rivetjs/kit"]): ApiModel => ({
  entries: entries.map((entry) => ({ entry, summary: "", runsOn: "both", href: "", symbols: symbols.filter((s) => s.entry === entry).map((s) => s.name) })),
  symbols,
});
const hrefs = (m: ApiModel) => Object.fromEntries(m.symbols.map((s) => [`${s.name} ${s.kind}`, s.href]));

test("names equal ignoring case: values keep the plain URL, the rest get a kind suffix", () => {
  const m = assignHrefs(
    model([
      symbol("@rivetjs/kit", "CodeInfo", "interface"),
      symbol("@rivetjs/kit", "codeInfo", "function"),
      symbol("@rivetjs/kit", "Router", "function"),
      symbol("@rivetjs/kit", "ROUTER", "variable"),
    ]),
  );
  assert.deepEqual(hrefs(m), {
    "CodeInfo interface": "/api/rivetjs/kit/CodeInfo-interface/",
    "codeInfo function": "/api/rivetjs/kit/codeInfo/",
    "Router function": "/api/rivetjs/kit/Router/",
    "ROUTER variable": "/api/rivetjs/kit/ROUTER-variable/",
  });
  assert.equal(m.entries[0]!.href, "/api/rivetjs/kit/");
});

test("same kind: code point order keeps the plain URL, the other gets -2; order of the input does not matter", () => {
  const a = assignHrefs(
    model([symbol("@rivetjs/kit", "jsonLd", "function"), symbol("@rivetjs/kit", "JsonLd", "function"), symbol("@rivetjs/kit", "JSONLD", "function")]),
  );
  const b = assignHrefs(
    model([symbol("@rivetjs/kit", "JSONLD", "function"), symbol("@rivetjs/kit", "JsonLd", "function"), symbol("@rivetjs/kit", "jsonLd", "function")]),
  );
  assert.deepEqual(hrefs(a), {
    "jsonLd function": "/api/rivetjs/kit/jsonLd-3/",
    "JsonLd function": "/api/rivetjs/kit/JsonLd-2/",
    "JSONLD function": "/api/rivetjs/kit/JSONLD/",
  });
  assert.deepEqual(hrefs(a), hrefs(b));
});

test("merged declarations share one page; other entries and an entry page itself are not touched", () => {
  const m = assignHrefs(
    model(
      [
        symbol("@rivetjs/forms", "StandardSchemaV1", "namespace"),
        symbol("@rivetjs/forms", "StandardSchemaV1", "interface"),
        symbol("@rivetjs/kit", "Icon", "function"),
        symbol("@rivetjs/kit", "Signal", "interface"),
      ],
      ["@rivetjs/forms", "@rivetjs/kit", "@rivetjs/kit/icon"],
    ),
  );
  assert.deepEqual(
    m.symbols.map((s) => s.href),
    ["/api/rivetjs/forms/StandardSchemaV1/", "/api/rivetjs/forms/StandardSchemaV1/", "/api/rivetjs/kit/Icon-function/", "/api/rivetjs/kit/Signal/"],
  );
});

test("committed api.json of every site: every page URL unique ignoring case, matching assignHrefs", () => {
  for (const app of ["docs", "cdk-docs", "ui-docs"]) {
    const committed = JSON.parse(readFileSync(new URL(`../../../apps/${app}/src/generated/api.json`, import.meta.url), "utf8")) as ApiModel;
    const seen = new Map<string, string>();
    for (const page of [...committed.entries, ...committed.symbols]) {
      const folded = page.href.toLowerCase();
      const other = seen.get(folded);
      assert.ok(other === undefined || other === page.href, `${app}: ${other} and ${page.href} differ only in letter case`);
      seen.set(folded, page.href);
    }
    const before = committed.symbols.map((s) => s.href);
    assert.deepEqual(
      assignHrefs(committed).symbols.map((s) => s.href),
      before,
      `${app}: api.json hrefs are stale (run docs-kit api)`,
    );
  }
});
