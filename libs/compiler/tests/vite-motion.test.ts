// MOTION-CSS end to end (`static-motion.ts` + the derived walk's call-site proof, `vite.ts`): a resumed page whose own
// boundary renders a CSS-only `<Motion.h1>` ships no Motion code (before: the adopt run of the page ran the Motion element
// inline, ~33 KB raw), the server writes the plain element (final state inline + `data-mve`) and the client build's CSS
// holds the rule. Under a `MotionConfig` the call keeps the component (the config may change the entrance).
import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "vite";
import { hasDerivedModel } from "../index.ts";
import { rivet } from "../vite.ts";

const TITLE = `<Motion.h1 class="t" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>Count {n()}</Motion.h1>`;
const page = (wrapped: boolean) => `import { signal } from "@rivetjs/reactivity";
import { Motion${wrapped ? ", MotionConfig" : ""} } from "@rivetjs/motion";
export default function Page() {
  const n = signal(0);
  return (
    <main>
      ${wrapped ? `<MotionConfig reducedMotion="always">${TITLE}</MotionConfig>` : TITLE}
      <button id="inc" onClick={() => n.update((v) => v + 1)}>+</button>
    </main>
  );
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

async function buildApp(wrapped: boolean, roots: string[]) {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/vite-motion-"));
  roots.push(root);
  await mkdir(resolve(root, "src"));
  await writeFile(resolve(root, "src/page.tsx"), page(wrapped));
  await writeFile(resolve(root, "src/server.tsx"), SERVER);
  // The router's generated `Root` stands above every route module (`resume.roots`, RT-DIET2): what it provides is known.
  await writeFile(resolve(root, "src/app.tsx"), "export default function Root(props) {\n  return <div>{props.children}</div>;\n}\n");
  await writeFile(resolve(root, "index.html"), "<!doctype html><p>client</p>");
  const plugin = () => rivet({ serverExports: { modules: ["src/page.tsx"] }, resume: { modules: ["src/page.tsx", "src/app.tsx"], roots: ["src/app.tsx"] } });
  await build({ root, configFile: false, logLevel: "silent", plugins: [plugin()], build: { outDir: "client-dist", manifest: true } });
  await build({ root, configFile: false, logLevel: "silent", plugins: [plugin()], build: { outDir: "server-dist", ssr: "src/server.tsx" } });
  const manifest = JSON.parse(await readFile(resolve(root, "client-dist/.vite/rivet-resume.json"), "utf8"));
  const { render } = await import(pathToFileURL(resolve(root, "server-dist/server.js")).href);
  const html: string = await render(manifest);
  const assets = resolve(root, "client-dist/assets");
  const files = await readdir(assets);
  const read = async (ext: string) => (await Promise.all(files.filter((f) => f.endsWith(ext)).map((f) => readFile(resolve(assets, f), "utf8")))).join("\n");
  return { html, js: await read(".js"), css: await read(".css") };
}

test.skipIf(!hasDerivedModel())(
  "a CSS-only Motion element in a resumed boundary ships no Motion code; under MotionConfig it keeps the component",
  async () => {
    const roots: string[] = [];
    try {
      const plain = await buildApp(false, roots);
      const hash = /<h1 class="t" style="opacity:1;translate:0px 0px" data-mve="(\w+)"/.exec(plain.html)?.[1];
      assert.ok(hash, plain.html);
      assert.ok(plain.css.includes(`[data-mve="${hash}"]`) && plain.css.includes("prefers-reduced-motion"), plain.css);
      // No Motion element in any client chunk (its binding attribute, the gesture glue, kit's transition scope).
      assert.ok(!/data-mv-t|data-mvv/.test(plain.js));
      const wrapped = await buildApp(true, roots);
      assert.ok(/data-mv(?:e|v)/.test(wrapped.html));
      assert.ok(!wrapped.html.includes(`data-mve="${hash}"`), "the config changes the entrance: the component renders it");
      assert.ok(/data-mv-t|data-mvv/.test(wrapped.js), "the component ships with the page's boundary");
    } finally {
      for (const root of roots) await rm(root, { recursive: true, force: true });
    }
  },
  120_000,
);
