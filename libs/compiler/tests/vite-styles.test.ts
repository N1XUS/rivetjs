import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build, createServer, type InlineConfig, type Plugin, type ViteDevServer } from "vite";
import { rivet, _STYLE_SUFFIX } from "../vite.ts";
import { nameRegistry, scopedName } from "../styles.ts";

const CARD = (color: string, extra = "") => `import { css, cx } from "@rivetjs/runtime/css";
import m from "./note.module.scss";
import "./plain.css";
const s = css\`
  .card { padding: 1rem; color: ${color}; }
  .title { font-weight: 600; }
\`;
export default (props: { title: string; on?: boolean }) => (
  <article class={s.card}><h2 class={\`\${s.title} text-lg\`}>{props.title}</h2><p class={cx(props.on && m.note)}>n</p>${extra}</article>
);
`;

async function project() {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-styles-"));
  await writeFile(resolve(root, "index.html"), '<!doctype html><div id="app"></div><script type="module" src="/client.tsx"></script>');
  await writeFile(resolve(root, "card.tsx"), CARD("red"));
  await writeFile(resolve(root, "note.module.scss"), "$c: #123456;\n.note { color: $c; .inner & { margin: 0 } }\n");
  await writeFile(resolve(root, "plain.css"), ".plain-proof { color: rgb(1, 2, 3) }\n");
  await writeFile(
    resolve(root, "client.tsx"),
    'import { mount } from "@rivetjs/runtime/dom"; import Card from "./card.tsx"; mount(() => <Card title="t" on />, document.querySelector("#app")!);',
  );
  await writeFile(
    resolve(root, "server.tsx"),
    'import { renderToString } from "@rivetjs/runtime/server"; import Card from "./card.tsx"; export const render = () => renderToString(<Card title="t" on />);',
  );
  return root;
}

test("build: css`` extracts into the CSS pipeline with short names, equal on server and client; modules and sass", async () => {
  const root = await project();
  try {
    const common: InlineConfig = { root, configFile: false, logLevel: "silent", plugins: [rivet()] };
    await build({ ...common, build: { outDir: "client-dist", minify: true } });
    const names = await readdir(resolve(root, "client-dist/assets"));
    const css = (await Promise.all(names.filter((n) => n.endsWith(".css")).map((n) => readFile(resolve(root, "client-dist/assets", n), "utf8")))).join("");
    const card = scopedName("card.tsx", "card", "short");
    const title = scopedName("card.tsx", "title", "short");
    const note = scopedName("note.module.scss", "note", "short");
    assert.match(css, /@layer theme,base\b/);
    assert.match(css, new RegExp(`@layer components\\{\\.${card}\\{[^}]*padding:1rem`));
    assert.match(css, new RegExp(`\\.${note}\\{color:#123456\\}`));
    assert.match(css, /plain-proof/);
    // Order: imported sheets first, the module's own css`` last (parent overrides children).
    assert.ok(css.indexOf("plain-proof") < css.indexOf(`.${card}`));
    const js = (await Promise.all(names.filter((n) => n.endsWith(".js")).map((n) => readFile(resolve(root, "client-dist/assets", n), "utf8")))).join("");
    assert.ok(js.includes(`class=\\"${card}\\"`) || js.includes(`class="${card}"`) || js.includes(`class=${card}`), "client template carries the folded class");
    assert.doesNotMatch(js, /padding:1rem/);
    await build({ ...common, build: { ssr: resolve(root, "server.tsx"), outDir: "server-dist" } });
    const mod = await import(pathToFileURL(resolve(root, "server-dist/server.js")).href);
    assert.equal(await mod.render(), `<article class="${card}"><h2 class="${title} text-lg">t</h2><p class="${note}">n</p></article>`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("dev: readable names, sheet served as CSS, CSS-only edits update only the sheet", async () => {
  const root = await project();
  let server: ViteDevServer | undefined;
  try {
    const plugin = rivet() as Plugin;
    server = await createServer({ root, configFile: false, logLevel: "silent", plugins: [plugin], server: { middlewareMode: true }, appType: "custom" });
    const card = resolve(root, "card.tsx");
    const module = await server.transformRequest("/card.tsx");
    assert.ok(module!.code.includes(`/card.tsx${_STYLE_SUFFIX}`), module!.code);
    const readable = scopedName("card.tsx", "card", "readable");
    assert.ok(module!.code.includes(readable));
    const sheet = await server.transformRequest(`/card.tsx${_STYLE_SUFFIX}?direct`);
    assert.match(sheet!.code, new RegExp(`\\.${readable} \\{ padding: 1rem; color: red; \\}`));
    const ssr = await server.ssrLoadModule("/server.tsx");
    assert.match(await ssr.render(), new RegExp(`<article class="${readable}">`));
    // Hot update: only CSS changed → only the stylesheet module updates.
    const environment = server.environments.client;
    await server.transformRequest(`/card.tsx${_STYLE_SUFFIX}`);
    const hot = plugin.hotUpdate as (this: unknown, options: unknown) => Promise<{ id: string | null }[] | undefined>;
    const call = (source: string) =>
      hot.call(
        { environment },
        { type: "update", file: card, timestamp: Date.now(), modules: [...(environment.moduleGraph.getModulesByFile(card) ?? [])], read: () => source, server },
      );
    const cssOnly = await call(CARD("blue"));
    assert.ok(cssOnly?.length && cssOnly.every((m) => m.id!.startsWith(card + _STYLE_SUFFIX)));
    const loaded = await server.transformRequest(`/card.tsx${_STYLE_SUFFIX}?direct`);
    assert.match(loaded!.code, /color: blue/);
    const both = await call(CARD("blue", "<i>x</i>"));
    assert.ok(both?.some((m) => m.id === card) && both.some((m) => m.id!.startsWith(card + _STYLE_SUFFIX)));
  } finally {
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("dev resume: a CSS-only edit of a resume module updates only the sheet (hotUpdate compiles like transform)", async () => {
  const root = await project();
  let server: ViteDevServer | undefined;
  try {
    const plugin = rivet({ resume: { modules: ["card.tsx"], dev: true } }) as Plugin;
    server = await createServer({ root, configFile: false, logLevel: "silent", plugins: [plugin], server: { middlewareMode: true }, appType: "custom" });
    const card = resolve(root, "card.tsx");
    const module = await server.transformRequest("/card.tsx");
    assert.ok(module!.code.includes(`/card.tsx${_STYLE_SUFFIX}`), module!.code);
    const environment = server.environments.client;
    await server.transformRequest(`/card.tsx${_STYLE_SUFFIX}`);
    const hot = plugin.hotUpdate as (this: unknown, options: unknown) => Promise<{ id: string | null }[] | undefined>;
    const call = (source: string) =>
      hot.call(
        { environment },
        { type: "update", file: card, timestamp: Date.now(), modules: [...(environment.moduleGraph.getModulesByFile(card) ?? [])], read: () => source, server },
      );
    const cssOnly = await call(CARD("blue"));
    assert.ok(cssOnly?.length && cssOnly.every((m) => m.id!.startsWith(card + _STYLE_SUFFIX)), JSON.stringify(cssOnly?.map((m) => m.id)));
  } finally {
    await server?.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("names registry reports collisions", () => {
  const registry = nameRegistry();
  assert.equal(registry.add("a.tsx", { x: "r000001" }), undefined);
  assert.equal(registry.add("a.tsx", { x: "r000001" }), undefined);
  assert.match(registry.add("b.tsx", { y: "r000001" })!, /collision: "r000001" for b\.tsx \.y and a\.tsx \.x/);
});
