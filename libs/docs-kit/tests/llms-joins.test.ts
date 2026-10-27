import { test } from "vitest";
import assert from "node:assert/strict";
import { llmsFrom } from "../tools/llms/generate.ts";
import type { LlmsSource } from "../tools/llms/source.ts";

test("LLMS joins preserve first duplicate page, symbol order, missing uses and ordered API prefixes", () => {
  const source = {
    app: "fixture",
    site: { name: "Fixture", tagline: "Test", origin: "https://example.test" },
    pages: [
      { path: "a", href: "/a/", title: "First", description: "", tags: [], sectionTitle: "Pages", body: "[symbol](/api/a/deeper/Thing/)" },
      { path: "a", href: "/b/", title: "Second", description: "", tags: [], sectionTitle: "Pages", body: "" },
    ],
    api: {
      entries: [
        { entry: "a", href: "/api/a/", summary: "", runsOn: "both" },
        { entry: "b", href: "/api/a/deeper/", summary: "", runsOn: "both" },
      ],
      symbols: ["Z", "A", "Z"].map((name) => ({
        key: name,
        entry: "a",
        name,
        kind: "function",
        summary: name,
        remarks: "",
        signatures: [],
        params: [],
        members: [],
        examples: [],
        runsOn: "both",
      })),
    },
    examples: new Map([["one", { id: "one", title: "One", summary: "", tags: [], files: [], usedOn: ["a", "missing", "a"] }]]),
    charts: new Map(),
    terms: new Map(),
    areas: [],
  } as unknown as LlmsSource;
  const output = llmsFrom(source);
  const usage = output.files.get("examples/one.md")!;
  assert.match(usage, /Used on: \[First\]\(https:\/\/example.test\/a.md\), \[First\]\(https:\/\/example.test\/a.md\)/);
  assert.doesNotMatch(usage, /Second|missing/);
  assert.match(output.files.get("a.md")!, /https:\/\/example.test\/api\/a.md#deeper\/thing/);
  assert.deepEqual(output.docs.find((doc) => doc.kind === "api")!.tags, ["Z", "A"]);
  const api = output.files.get("api/a.md")!;
  assert.ok(api.indexOf("## `Z`") < api.indexOf("## `A`"));
  assert.ok(api.lastIndexOf("## `Z`") > api.indexOf("## `A`"));
  let changed = false;
  const custom = llmsFrom(source, {
    link(target, live) {
      if (!changed) {
        changed = true;
        live.pages[0] = { ...live.pages[0]!, title: "Changed" };
        live.api.symbols.push({ ...live.api.symbols[0]!, name: "Added" });
      }
      return "https://example.test" + target.href;
    },
  });
  assert.match(custom.files.get("examples/one.md")!, /Used on: \[Changed\]/);
  assert.ok(custom.files.get("api/a.md")!.includes("## `Added`"));
});
