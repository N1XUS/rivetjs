// C3 size gate: a production (DOM v2) app using <Show> / <Switch> pays only for the v2 twins
// (`_show` / `_switch` / `_match`), not for a second DOM core. Bundles the compiled app (minified,
// production conditions) with and without the control flow and compares brotli sizes.
import { test } from "vitest";
import assert from "node:assert/strict";
import { brotliCompressSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { rolldown } from "rolldown";
import { compile } from "../index.ts";

const dom = fileURLToPath(new URL("../../runtime/dom.ts", import.meta.url));
const app = (body: string) => `import { For, Show, Switch, Match, mount } from "@rivetjs/runtime/dom";
import { signal } from "@rivetjs/reactivity";
const items = signal([1, 2, 3]), on = signal(true), n = signal(1);
const App = () => <ul>${body}</ul>;
mount(() => <App />, document.body);
`;

async function brotli(code: string): Promise<number> {
  const bundle = await rolldown({
    input: "app.js",
    platform: "browser",
    logLevel: "silent",
    resolve: { conditionNames: ["import", "production", "default"], alias: { "@rivetjs/runtime/dom": dom } },
    transform: { define: { "process.env.NODE_ENV": '"production"' } },
    plugins: [{ name: "app", resolveId: (id) => (id === "app.js" ? id : null), load: (id) => (id === "app.js" ? code : null) }],
  });
  const { output } = await bundle.generate({ format: "esm", minify: true });
  return brotliCompressSync(output[0].code).length;
}

const dom2 = (source: string) => {
  const r = compile(source, { target: "dom", filename: "app.tsx" });
  assert.deepEqual(r.diagnostics, []);
  return r.code;
};

test("v2 Show / Switch cost < 850 B brotli on top of a For app (app code included)", async () => {
  const base = await brotli(dom2(app(`<For each={items} by={(x) => x}>{(x) => <li>{x()}</li>}</For>`)));
  const flow = dom2(
    app(
      `<Show when={on} fallback={<li>off</li>}><For each={items} by={(x) => x}>{(x) => <li>{x()}</li>}</For></Show>` +
        `<Switch fallback={<li>none</li>}><Match when={() => n() > 1}><li>big</li></Match></Switch>`,
    ),
  );
  assert.match(flow, /_show\b/);
  assert.match(flow, /_switch\b/);
  const withFlow = await brotli(flow);
  console.log(`brotli: For only ${base} B, + Show/Switch ${withFlow} B (+${withFlow - base})`);
  // App code included (templates, props): the twins themselves are a few hundred bytes.
  // 773 → 801 B (2026-10-08): `when` value-or-accessor (live props, RV1014 retired) adds the `when()` reader to
  // `_show` / `_switch`; app code is unchanged (no dynamic component props here).
  assert.ok(withFlow - base < 850, `Show/Switch cost ${withFlow - base} B brotli`);
});
