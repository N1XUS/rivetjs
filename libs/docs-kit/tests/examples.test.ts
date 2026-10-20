// Example generation (tools/examples.ts): which examples run as pages of the docs app (`framePlan`), their grouped
// stylesheets (`groupCSS`), route module exports (`exportNames`) and the plain code shown next to them (`shownFile`).
import { strict as assert } from "node:assert";
import { test } from "vitest";
import type { ExampleConfig } from "../define.ts";
import { exportNames, focusRegion, framePlan, groupCSS, shownFile } from "../tools/examples.ts";

const config = (extra: Partial<ExampleConfig> = {}): ExampleConfig => ({ title: "T", summary: "S", show: ["src/routes/index.tsx"], ...extra });
const plan = (files: string[], sources: Record<string, string> = {}, extra: Partial<ExampleConfig> = {}) =>
  framePlan(config(extra), files, new Map(Object.entries(sources)));

test("framePlan: static pages with layouts and route groups run live, each page with its layout chain", () => {
  const result = plan([
    "src/routes/_layout.tsx",
    "src/routes/(shop)/_layout.tsx",
    "src/routes/(shop)/index.tsx",
    "src/routes/help.tsx",
    "src/routes/docs/intro.tsx",
    "src/components/Card.tsx",
    "src/styles.css",
  ]);
  assert.deepEqual(result, {
    pages: [
      { path: "", file: "(shop)/index.tsx", layouts: ["_layout.tsx", "(shop)/_layout.tsx"] },
      { path: "docs/intro", file: "docs/intro.tsx", layouts: ["_layout.tsx"] },
      { path: "help", file: "help.tsx", layouts: ["_layout.tsx"] },
    ],
  });
});

test("framePlan: what is shown as code only, and why", () => {
  const why = (result: ReturnType<typeof framePlan>) => ("codeOnly" in result ? result.codeOnly : "live");
  assert.match(why(plan(["src/routes/index.tsx"], {}, { mode: "server" })), /server/);
  assert.match(why(plan(["src/routes/index.tsx", "vite.config.ts"])), /own app \(vite\.config\.ts/);
  assert.match(why(plan(["src/routes/index.tsx", "locales/en.json"])), /i18n/);
  assert.match(why(plan(["src/routes/index.tsx", "src/document.ts"])), /own app/);
  assert.match(why(plan(["src/routes/index.tsx"], {}, { frame: { theme: false } })), /own theme/);
  assert.match(why(plan(["src/routes/index.tsx", "src/routes/api/data.ts"])), /server routes/);
  assert.match(why(plan(["src/routes/index.tsx", "src/routes/_404.tsx"])), /404/);
  assert.match(why(plan(["src/routes/index.tsx", "src/routes/posts/[slug].tsx"])), /dynamic/);
  assert.match(why(plan(["src/routes/about.tsx"])), /no page at \//);
  assert.match(
    why(
      plan(["src/routes/index.tsx", "src/routes/_layout.tsx"], {
        "src/routes/_layout.tsx": 'import { load } from "@rivetjs/router";\nexport const loader = load(async () => {});\nexport default () => null;',
      }),
    ),
    /layout runs server code/,
  );
  const linked = ["src/routes/index.tsx", "src/routes/about.tsx"];
  assert.match(why(plan(linked, { "src/routes/index.tsx": '<a href="/about">About</a>' })), /absolute paths/);
  assert.match(why(plan(linked, { "src/routes/index.tsx": "<a href={withBase('about')}>About</a>" })), /absolute paths/);
  // Relative links between pages, external links and single pages with absolute hrefs stay live.
  assert.equal(why(plan(linked, { "src/routes/index.tsx": '<a href="about/">About</a> <a href="//x.dev/">x</a>' })), "live");
  assert.equal(why(plan(["src/routes/index.tsx"], { "src/routes/index.tsx": '<a href="/">Home</a>' })), "live");
});

test("groupCSS: Tailwind scans only the members' sources; their @source lines repeat per member", () => {
  const text = '@import "tailwindcss";\n@source "../../../libs/ui";\n@source "./";\n.a { color: red; }\n';
  const out = groupCSS(text, ["one", "two"], (id) => `../../examples/${id}/src`);
  assert.equal(
    out,
    '@import "tailwindcss" source(none);\n@source "../../libs/ui";\n@source "../../libs/ui";\n@source "../../examples/one/src/";\n@source "../../examples/two/src/";\n.a { color: red; }\n',
  );
  assert.throws(() => groupCSS('@import "./theme.css";', ["one"], () => "x"), /relative @import/);
  assert.throws(() => groupCSS('.a { background: url("./a.png"); }', ["one"], () => "x"), /url\(\)/);
});

test("exportNames: route module exports", () => {
  const source = [
    "export const head = { title: 'x' };",
    "export const loader = load(async () => {});",
    "export default function Page() {}",
    "export { a, b as prerender, type T };",
    "const hidden = 1;",
  ].join("\n");
  assert.deepEqual(exportNames(source).sort(), ["a", "default", "head", "loader", "prerender"]);
});

test("focusRegion + shownFile: region markers and line notations stripped, focus and marks kept", () => {
  assert.deepEqual(focusRegion("a\n// #region demo\nb\nc\n// #endregion\nd\n"), { text: "a\nb\nc\nd\n", focus: [2, 3] });
  assert.deepEqual(focusRegion("a\nb\n"), { text: "a\nb\n" });
  const file = shownFile("src/a.tsx", "const a = 1; // [!code ++]\nconst b = 2;\n");
  assert.equal(file.path, "src/a.tsx");
  assert.equal(file.text, "const a = 1;\nconst b = 2;\n");
  assert.deepEqual(file.marks, { 1: "add" });
});
