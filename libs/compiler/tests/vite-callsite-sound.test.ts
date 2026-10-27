// CTX-SOUND (2026-10-27): the call-site context proof (`facts-callsite.ts`, ZERO CALLSITE) end to end through the real
// Vite plugin. The proof reads the providers above a call from the component tags that enclose it in the caller's JSX
// (`calls[].around`, lexical). JSX inside a nested function runs where that function is called, which may be under a
// provider the lexical walk does not see (`const row = () => <X />; <P>{row()}</P>`, a function child, a render prop, a
// local component, a top-level helper); a `CTXFREE` / `SITE` record there adopted standalone with the default value
// while the server rendered the provided one. Each shape renders a part reading the context straight (`D_*`: dependent,
// `SITE` path) and through a hook (`H_*`: independent, `CTXFREE` path); the first click on a cold resumed page must keep
// the server's class (the provided value) and count. Eager JSX (`const t = <X />`, `.map` in the body) is created
// before the provider runs: it reads the default on both sides and stays proven.
import { test } from "vitest";
import assert from "node:assert/strict";
import { createServer as createHttp } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { chromium } from "playwright";
import { hasDerivedModel } from "../index.ts";
import { rivet } from "../vite.ts";
import { expandTail } from "@rivetjs/runtime/resume-format";

const CTX = `import { createContext, useContext } from "@rivetjs/reactivity";
export const Theme = createContext("light");
export function useTheme() { return useContext(Theme); }
`;
const P = `import { Provider } from "@rivetjs/runtime/dom";
import { Theme } from "./ctx.tsx";
export function P(props: { children?: unknown; render?: () => unknown }) {
  return <Provider token={Theme} value="dark"><section>{props.children as never}{props.render?.() as never}</section></Provider>;
}
`;
/** Shape → [caller body, expected theme per part instance (server = browser)]. */
const SHAPES: Record<string, { body: string; expect: string[]; proven: boolean }> = {
  // Eager: created before `P` runs (default on both sides): proven, and right.
  eager: { body: `const a = <D_eager label="a" />; const b = <H_eager label="b" />; return <P>{a}{b}</P>;`, expect: ["light", "light"], proven: true },
  map: { body: `const list = [0].map(() => [<D_map label="a" />, <H_map label="b" />]); return <P>{list}</P>;`, expect: ["light", "light"], proven: true },
  lexical: { body: `return <P><D_lexical label="a" /><H_lexical label="b" /></P>;`, expect: ["dark", "dark"], proven: false },
  hook: { body: `return <P><H_hook label="b" /></P>;`, expect: ["dark"], proven: false },
  // Lazy: run where the function is called, under `P` (or the caller's own provider element).
  call: {
    body: `const a = () => <D_call label="a" />; const b = () => <H_call label="b" />; return <P>{a()}{b()}</P>;`,
    expect: ["dark", "dark"],
    proven: false,
  },
  child: {
    body: `const a = () => <D_child label="a" />; const b = () => <H_child label="b" />; return <P>{a}{b}</P>;`,
    expect: ["dark", "dark"],
    proven: false,
  },
  render: { body: `const r = () => [<D_render label="a" />, <H_render label="b" />]; return <P render={r} />;`, expect: ["dark", "dark"], proven: false },
  inner: { body: `const Inner = () => [<D_inner label="a" />, <H_inner label="b" />]; return <P><Inner /></P>;`, expect: ["dark", "dark"], proven: false },
  own: {
    body: `const a = () => <D_own label="a" />; const b = () => <H_own label="b" />; return <Provider token={Theme} value="dark"><div>{a()}{b()}</div></Provider>;`,
    expect: ["dark", "dark"],
    proven: false,
  },
  // A top-level helper (no component: its calls were not call sites at all) next to a plain, provable site.
  helper: {
    body: `return <div><D_helper label="a" /><H_helper label="b" /><P>{helperRows()}</P></div>;`,
    expect: ["light", "light", "dark", "dark"],
    proven: false,
  },
};
const parts = Object.keys(SHAPES)
  .map(
    (k) => `export function D_${k}(props: { label: string }) {
  const theme = useContext(Theme);
  const n = signal(0);
  return <button class={"part ${k} " + theme} onClick={() => n.set(n() + 1)}>{props.label}{n()}</button>;
}
export function H_${k}(props: { label: string }) {
  const theme = useTheme();
  const n = signal(0);
  return <button class={"part ${k} " + theme} onClick={() => n.set(n() + 1)}>{props.label}{n()}</button>;
}`,
  )
  .join("\n");
const PARTS = `import { signal, useContext } from "@rivetjs/reactivity";
import { Theme, useTheme } from "./ctx.tsx";
${parts}
`;
const names = Object.keys(SHAPES).flatMap((k) => ["D_" + k, "H_" + k]);
const PAGE = `import { ${names.join(", ")} } from "./parts.tsx";
import { Provider } from "@rivetjs/runtime/dom";
import { P } from "./p.tsx";
import { Theme } from "./ctx.tsx";
function helperRows() { return [<D_helper label="c" />, <H_helper label="d" />]; }
${Object.entries(SHAPES)
  .map(([k, { body }]) => `export function Shape_${k}() { ${body} }`)
  .join("\n")}
export default function Page() {
  return <main>${Object.keys(SHAPES)
    .map((k) => `<Shape_${k} />`)
    .join("")}</main>;
}
`;
const SERVER = `import { createApp } from "@rivetjs/router/server";
import Page from "./page.tsx";
const entry = {
  routes: [{ id: "p", pattern: "/*rest", page: true, layouts: [] }],
  universal: {},
  page: () => () => Page({}),
  document: () => ({ start: "<!doctype html><html><body>", end: "</body></html>" }),
};
export const render = async (manifest) => (await createApp({ entry, manifest, csp: false })(new Request("http://x/"))).text();
`;
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".css": "text/css" };
const CTXFREE = 4096;
const INDEPENDENT = 1;

(hasDerivedModel() ? test : test.skip)(
  "a part under a provider its call's lexical position does not show keeps the provided value on its first cold click",
  async () => {
    await mkdir(".artifacts", { recursive: true });
    const root = await mkdtemp(resolve(".artifacts/vite-callsite-sound-"));
    const browser = await chromium.launch({ headless: true });
    try {
      await mkdir(resolve(root, "src"));
      for (const [file, text] of Object.entries({ "ctx.tsx": CTX, "p.tsx": P, "parts.tsx": PARTS, "page.tsx": PAGE, "server.tsx": SERVER }))
        await writeFile(resolve(root, "src", file), text);
      // The router's generated `Root` stands above every route module (`resume.roots`, RT-DIET2): what it provides is known.
      await writeFile(resolve(root, "src/app.tsx"), "export default function Root(props) {\n  return <div>{props.children}</div>;\n}\n");
      await writeFile(resolve(root, "index.html"), "<!doctype html><p>client</p>");
      const modules = ["src/page.tsx", "src/parts.tsx", "src/p.tsx", "src/ctx.tsx", "src/app.tsx"];
      const plugin = () => rivet({ serverExports: { modules: ["src/page.tsx"] }, resume: { modules, roots: ["src/app.tsx"] } });
      await build({ root, configFile: false, logLevel: "silent", plugins: [plugin()], build: { outDir: "client-dist", manifest: true } });
      await build({ root, configFile: false, logLevel: "silent", plugins: [plugin()], build: { outDir: "server-dist", ssr: "src/server.tsx" } });
      const manifest = JSON.parse(await readFile(resolve(root, "client-dist/.vite/rivet-resume.json"), "utf8"));
      const { render } = await import(pathToFileURL(resolve(root, "server-dist/server.js")).href);
      const html: string = await render(manifest);
      // Server: each part renders the value its runtime position sees.
      const server = [...html.matchAll(/<button class="part (\w+) (\w+)"/g)].map((m) => [m[1], m[2]]);
      const want = Object.entries(SHAPES).flatMap(([k, { expect }]) => expect.map((theme) => [k, theme]));
      assert.deepEqual(server, want, "server classes");
      // Records: a part whose site is not proven is dependent (adopts with the provider's record): `D_*` reads the
      // context itself, `H_*` through a hook (the component facts call it independent; the proof demotes it, CTX-SOUND);
      // the eager shapes keep their proof (`SITE`: independent with its props).
      const tail = expandTail(JSON.parse(/<script type="rivet\/boundaries"[^>]*>([\s\S]*?)<\/script>/.exec(html)![1]!)) as { b: unknown[][] };
      const flags = new Map<string, number[]>();
      for (const r of tail.b) {
        const name = String(r[3]).slice(String(r[3]).indexOf("#") + 1);
        if (/^[DH]_/.test(name)) flags.set(name, [...(flags.get(name) ?? []), r[2] as number]);
      }
      for (const [k, { proven }] of Object.entries(SHAPES)) {
        const d = flags.get("D_" + k) ?? [];
        const h = flags.get("H_" + k) ?? [];
        if (proven) assert.ok(d.length > 0 && d.every((f) => f & INDEPENDENT) && h.every((f) => f & INDEPENDENT), k + ": SITE " + d + " / " + h);
        // The helper's plain instance (written in the component) is proven; the helper's own is not.
        else if (k === "helper")
          assert.ok(d.filter((f) => f & INDEPENDENT).length === 1 && h.filter((f) => f & INDEPENDENT).length === 1, k + ": " + d + " / " + h);
        else assert.ok(d.every((f) => !(f & INDEPENDENT)) && h.every((f) => !(f & INDEPENDENT)), k + ": " + d + " / " + h);
      }
      // Browser: cold first click on every part (production build), the class stays the server's and the count moves.
      const http = createHttp(async (req, res) => {
        const path = decodeURIComponent(new URL(req.url!, "http://x").pathname);
        try {
          const body = path === "/" ? Buffer.from(html) : await readFile(resolve(root, "client-dist", "." + path));
          res.setHeader("Content-Type", TYPES[extname(path)] ?? (path === "/" ? "text/html" : "application/octet-stream"));
          res.end(body);
        } catch {
          res.statusCode = 404;
          res.end();
        }
      });
      await new Promise<void>((r) => http.listen(0, "127.0.0.1", r));
      try {
        const results: string[][] = [];
        const count = server.length;
        for (let i = 0; i < count; i++) {
          const context = await browser.newContext();
          const page = await context.newPage();
          const errors: string[] = [];
          page.on("pageerror", (error) => errors.push(error.message));
          page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
          await page.goto(`http://127.0.0.1:${(http.address() as { port: number }).port}/`);
          const label = await page.locator("button.part").nth(i).textContent();
          await page.locator("button.part").nth(i).click();
          await page
            .waitForFunction(([n, text]) => document.querySelectorAll("button.part")[n as number]!.textContent !== text, [i, label] as const, { timeout: 5000 })
            .catch(() => {});
          const after = await page.evaluate((n) => {
            const el = document.querySelectorAll("button.part")[n]!;
            return [el.className.split(" ")[1]!, el.className.split(" ")[2]!, el.textContent!];
          }, i);
          results.push([...after, errors.join(" | ")]);
          await context.close();
        }
        const expected = server.map(([k, theme], i) => [k!, theme!, /^[a-d]/.exec(results[i]![2]!)![0] + "1", ""]);
        assert.deepEqual(results, expected, "after the first cold click");
      } finally {
        http.close();
      }
    } finally {
      await browser.close();
      if (!process.env.KEEP) await rm(root, { recursive: true, force: true });
    }
  },
  240_000,
);
