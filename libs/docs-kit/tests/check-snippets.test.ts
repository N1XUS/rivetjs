// `docs-kit check-snippets`: fences must parse (excerpt forms allowed), importing fences must not drift
// from the packages' exports, `check` fences typecheck fully, `nocheck` fences are skipped.
import { strict as assert } from "node:assert";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, test } from "vitest";
import { checkSnippets, extractSnippets, syntaxErrors } from "../tools/check-snippets.ts";

const fence = (lang: string, code: string, meta = "") => "```" + lang + (meta ? " " + meta : "") + "\n" + code + "\n```\n";
const one = (lang: string, code: string) => extractSnippets(fence(lang, code), "page.md")[0]!;

test("extracts ts/tsx/js/jsx fences with their opening line and meta, nested in lists too", () => {
  const md = "# Title\n\n" + fence("tsx", "<p />", 'title="a.tsx"') + "\n- item\n\n  ```ts\n  const a = 1;\n  ```\n\n" + fence("bash", "npm i");
  const snippets = extractSnippets(md, "page.md");
  assert.deepEqual(
    snippets.map((s) => [s.lang, s.line, s.meta, s.code]),
    [
      ["tsx", 3, 'title="a.tsx"', "<p />"],
      ["ts", 9, "", "const a = 1;"],
    ],
  );
});

test("excerpts parse: sibling markup, elisions, object members, call items, one JSX element per statement", () => {
  for (const [lang, code] of [
    ["tsx", "<A />\n<B />"],
    ["tsx", "<Menu onAction={(key) => …} />"],
    ["ts", 'cookie: { name: "lang" },\nother: 1,'],
    ["ts", 'rivetRouter({\n  mode: "static",\n}),'],
    ["tsx", 'import { Link } from "x";\n\n// a link\n<Link to="/a">A</Link>\n\n// a form\n<form method="post" />'],
  ] as const)
    assert.deepEqual(syntaxErrors(one(lang, code)), [], code);
});

test("broken fences are reported at their Markdown line", () => {
  const md = "intro\n\n" + fence("ts", "const ok = 1;\nconst x = ;");
  const [snippet] = extractSnippets(md, "page.md");
  const errors = syntaxErrors(snippet!);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]!.line, 5); // fence at line 3, code line 2
  assert.match(errors[0]!.message, /Expression expected/);
  assert.equal(syntaxErrors(one("tsx", "<div>\n  <p>unclosed\n</div>")).length, 1);
  assert.equal(syntaxErrors(one("ts", "function f( {")).length, 1);
});

const root = fileURLToPath(new URL(`./.artifacts/check-snippets-${process.pid}`, import.meta.url));

beforeAll(() => {
  mkdirSync(resolve(root, "content"), { recursive: true });
  writeFileSync(resolve(root, "tsconfig.json"), JSON.stringify({ extends: "../../../../../tsconfig.base.json", include: [] }));
  writeFileSync(
    resolve(root, "content/page.md"),
    [
      "# Page\n",
      // Excerpt using prose names: only drift counts, so this passes.
      fence("ts", 'import { signal } from "@rivetjs/reactivity";\nconst count = signal(0);\ncount.set(undefinedName);'),
      // A missing relative module is the page's own illustrative file.
      fence("ts", 'import { db } from "../db.server.ts";\ndb();'),
      // Drift: a removed export and a removed module.
      fence("ts", 'import { notAnExport } from "@rivetjs/reactivity";\nnotAnExport();'),
      fence("ts", 'import { x } from "@rivetjs/no-such-package";\nx();'),
      // `check`: every diagnostic fails.
      fence("ts", 'import { signal } from "@rivetjs/reactivity";\nconst n: number = signal("a")();', "check"),
      // `nocheck`: skipped even though it does not parse.
      fence("ts", "this is pseudo code(", "nocheck"),
    ].join("\n"),
  );
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

test("importing fences: drift fails, excerpt names and relative modules do not; check and nocheck meta", () => {
  const { snippets, failures } = checkSnippets(root);
  assert.equal(snippets.length, 5);
  const found = failures.map((f) => [f.line, f.message.slice(0, 7)]);
  // Fences open at lines 3, 9, 14, 19, 24 (+1 for the code line of the diagnostic).
  assert.deepEqual(found, [
    [15, "TS2305:"],
    [20, "TS2307:"],
    [26, "TS2322:"],
  ]);
});
