import { test, expect } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build, type Plugin } from "vite";
import { rivet } from "@rivetjs/compiler/vite";
import { solid } from "../vite.ts";

export const solidAliases = (ssr: boolean) => [
  { find: /^solid-js$/, replacement: fileURLToPath(new URL(`../node_modules/solid-js/dist/${ssr ? "server" : "solid"}.js`, import.meta.url)) },
  { find: /^solid-js\/web$/, replacement: fileURLToPath(new URL(`../node_modules/solid-js/web/dist/${ssr ? "server" : "web"}.js`, import.meta.url)) },
  { find: /^solid-js\/store$/, replacement: fileURLToPath(new URL(`../node_modules/solid-js/store/dist/${ssr ? "server" : "store"}.js`, import.meta.url)) },
];

test("real Vite app compiles suffix, pragma and included Solid islands natively for browser and SSR", async () => {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/bridge-solid-build-"));
  try {
    await mkdir(resolve(root, "src/foreign"), { recursive: true });
    await writeFile(resolve(root, "index.html"), "<!doctype html><p>static</p>");
    await writeFile(
      resolve(root, "src/Counter.solid.tsx"),
      `import {createSignal,createUniqueId} from "solid-js";
export function Counter(props:{count:number}) { const [n,setN]=createSignal(props.count); return <button id={createUniqueId()} onClick={()=>setN(n()+1)}>{n()}</button>; }`,
    );
    await writeFile(resolve(root, "src/Pragma.tsx"), `/** @jsxImportSource solid-js */\nexport function Pragma(){return <i>pragma</i>}`);
    await writeFile(resolve(root, "src/foreign/Included.tsx"), `export function Included(){return <b>included</b>}`);
    await writeFile(
      resolve(root, "src/page.tsx"),
      `import {Counter} from './Counter.solid.tsx'; import {Pragma} from './Pragma.tsx'; import {Included} from './foreign/Included.tsx';
export function Page(){return <main><Counter count={1} client="load"/><Pragma client="visible"/><Included client="idle"/></main>}`,
    );
    await writeFile(
      resolve(root, "src/entry.tsx"),
      `import {resumableToString} from '@rivetjs/runtime/server-resume'; import {withIdScope} from '@rivetjs/runtime/id'; import {Page} from './page.tsx'; export const render=(manifest:never)=>withIdScope('rv',()=>resumableToString(()=> <Page/>,{manifest,nonce:'build-nonce'}));`,
    );
    const modules: string[] = [];
    const record: Plugin = {
      name: "record-solid-modules",
      generateBundle(_, bundle) {
        for (const out of Object.values(bundle)) if (out.type === "chunk") modules.push(...Object.keys(out.modules));
      },
    };
    const plugins = () => [rivet({ resume: { modules: ["src/page.tsx"] }, bridges: [solid({ include: ["src/foreign/**"] })] })];
    await build({
      configFile: false,
      root,
      logLevel: "silent",
      resolve: { alias: solidAliases(false) },
      plugins: [...plugins(), record],
      build: { minify: false },
    });
    const manifest = JSON.parse(await readFile(resolve(root, "dist/.vite/rivet-resume.json"), "utf8"));
    expect(Object.keys(manifest.islands).sort()).toEqual(["src/Counter.solid.tsx#Counter", "src/Pragma.tsx#Pragma", "src/foreign/Included.tsx#Included"]);
    expect(modules.some((id) => id.includes("libs/bridge-solid/node_modules/solid-js/web/dist/web.js"))).toBe(true);
    expect(modules.some((id) => /\/node_modules\/solid-js\//.test(id) && !id.includes("bridge-solid/node_modules"))).toBe(false);
    expect(modules.some((id) => id.endsWith("/libs/runtime/jsx-runtime.ts"))).toBe(false);
    const manifestFiles = Object.values(manifest.islands) as string[];
    const js = (await Promise.all(manifestFiles.map((file) => readFile(resolve(root, "dist", file.replace(/^\//, "")), "utf8")))).join("\n");
    expect(js).not.toContain("$$click");
    await build({
      configFile: false,
      root,
      logLevel: "silent",
      resolve: { alias: solidAliases(true) },
      ssr: { noExternal: ["solid-js"] },
      plugins: plugins(),
      build: { outDir: "dist-server", ssr: "src/entry.tsx", minify: false },
    });
    const { render } = await import(pathToFileURL(resolve(root, "dist-server/entry.js")).href);
    const html = (await render(manifest)) as string;
    expect(html).toContain('nonce="build-nonce"');
    expect(html).toContain("data-hk=");
    expect(html).toContain(">pragma</i>");
    expect(html).toContain(">included</b>");
    expect(html.match(/window\._\$HY/g)).toHaveLength(1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);
