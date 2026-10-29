// `@rivetjs/cdk/highlight` (Rivet-authored regex tokenizer; feature set scoped from public docs of commercial UI kits):
// tokens round-trip the source, language aliases + labels, key token types per language.
import { test } from "vitest";
import assert from "node:assert/strict";
import { highlight, languageLabel, resolveLanguage } from "../highlight/index.tsx";

const SAMPLES: Record<string, string> = {
  ts: 'import { a } from "b";\n// note\nconst x: Array<number> = [1, 2.5];\nfunction f<T>(v: T) { return g(v) ?? null; }',
  json: '{"a": 1, "b": [true, null], "c": "s"}',
  css: ".a:hover { color: #fff; margin: 0 4px; } /* c */",
  html: "<div class=\"a\" data-x='1'><!-- c --><b>t</b></div>",
  bash: '# c\nnpm install --save x && echo "$HOME"',
  python: "def f(x):\n    # c\n    return True if x else None",
  sql: "SELECT id, name FROM users WHERE id = 1; -- c",
  yaml: "key: value\nlist:\n  - 1 # c\n  - true",
  diff: "@@ -1 +1 @@\n-old\n+new\n same",
  rust: 'fn main() { let x: i32 = 5; println!("{}", x); }',
};

test("highlight: tokens round-trip the source", () => {
  for (const [lang, code] of Object.entries(SAMPLES)) {
    const tokens = highlight(code, lang);
    assert.equal(tokens.map((t) => t.value).join(""), code, lang);
  }
});

test("highlight: aliases + labels", () => {
  assert.equal(resolveLanguage("tsx"), "js");
  assert.equal(resolveLanguage("sh"), "shell");
  assert.equal(resolveLanguage("nope"), "plaintext");
  assert.equal(languageLabel("ts"), "TypeScript");
  assert.equal(languageLabel(undefined), "Text");
});

test("highlight: token types", () => {
  const types = (lang: string) => new Set(highlight(SAMPLES[lang]!, lang).map((t) => t.type));
  const ts = types("ts");
  for (const t of ["keyword", "string", "comment", "number", "function", "type"]) assert.ok(ts.has(t as never), `ts ${t}`);
  assert.ok(!highlight(SAMPLES.ts!, "ts").some((t) => t.type === "tag"), "TS generics are not tags");
  assert.ok(types("json").has("property"));
  assert.ok(types("html").has("tag") && types("html").has("attribute"));
  assert.ok(types("bash").has("function"));
  assert.ok(types("diff").has("inserted") && types("diff").has("deleted"));
  assert.deepEqual(highlight("plain <b>", "plaintext"), [{ type: "plain", value: "plain <b>" }]);
});
