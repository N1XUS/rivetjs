// Lane X7: the codex "server-scale" pages rebuilt from THIS tree (THROWAWAY). N instances of the docs examples
// two-way-input ("greeting") / show-hide ("details") under numbered <section>s:
// - <label>.ordinary-resume.mjs: production Vite build (rivet plugin, derived resume) through the router's renderDocument;
// - <label>.ordinary.mjs: bare non-resumable floor (plain server compile + renderToString, rolldown production bundle).
// usage: node cold-build.mjs <repo root> <out dir>
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const repo = resolve(process.argv[2]),
  app = resolve(process.argv[3]);
const at = (path) => import(pathToFileURL(resolve(repo, path)).href);
const { build } = await at("node_modules/vite/dist/node/index.js");
const { rolldown } = await at("node_modules/rolldown/dist/index.mjs");
const { rivet } = await at("libs/compiler/vite.ts");
const { compile } = await at("libs/compiler/index.ts");
await mkdir(app, { recursive: true });
const fixtures = { greeting: "apps/docs/examples/two-way-input/src/routes/index.tsx", details: "apps/docs/examples/show-hide/src/routes/index.tsx" };
const prefix = '<!doctype html><html><head><meta charset="utf-8"><title>cold resume</title></head><body><main id="app">';
for (const [label, path] of Object.entries(fixtures)) await writeFile(resolve(app, label + ".tsx"), await readFile(resolve(repo, path)));
await writeFile(
  resolve(app, "entry.ts"),
  `export {default as Greeting} from './greeting.tsx';export {default as Details} from './details.tsx';export {mount} from '@rivetjs/runtime/dom';`,
);
await writeFile(
  resolve(app, "server.ts"),
  `import Greeting from './greeting.tsx';import Details from './details.tsx';
import {renderDocument} from ${JSON.stringify(resolve(repo, "libs/router/server/render.ts"))};
export {template} from '@rivetjs/runtime/server';
export const value=label=>(label==='greeting'?Greeting:Details)();
export const renderFactory=(factory,manifest)=>renderDocument(factory,{head:undefined,nonce:undefined,url:new URL('http://localhost/'),status:200,styles:[]},{manifest,document:()=>({start:${JSON.stringify(prefix)},end:'</main></body></html>'})},{status:200,headers:new Headers()});
`,
);
const plugin = () => rivet({ devtools: false, resume: { modules: ["greeting.tsx", "details.tsx"], roots: ["greeting.tsx", "details.tsx"] } });
const quiet = { root: app, configFile: false, logLevel: "silent" };
await build({
  ...quiet,
  plugins: [plugin()],
  build: { outDir: "client", manifest: true, rollupOptions: { input: resolve(app, "entry.ts"), preserveEntrySignatures: "strict" } },
});
await build({ ...quiet, plugins: [plugin()], build: { outDir: "server", ssr: "server.ts" } });
const manifest = await readFile(resolve(app, "client/.vite/rivet-resume.json"), "utf8");
const server = JSON.stringify(pathToFileURL(resolve(app, "server/server.js")).href);
for (const [label, path] of Object.entries(fixtures)) {
  await writeFile(
    resolve(app, label + ".ordinary-resume.mjs"),
    `import {value,template,renderFactory} from ${server};const manifest=${manifest};export async function page(n){return(await renderFactory(()=>Array.from({length:n},(_,i)=>template(['<section data-instance="'+i+'">','</section>'],[value(${JSON.stringify(label)})])),manifest)).text()}`,
  );
  await writeFile(resolve(app, label + ".plain.js"), compile(await readFile(resolve(repo, path), "utf8"), { target: "server", filename: path }).code);
  await writeFile(
    resolve(app, label + ".bare-entry.js"),
    `import App from './${label}.plain.js';import {renderToString,template} from '@rivetjs/runtime/server';const prefix=${JSON.stringify(prefix)};const open=i=>'<section data-instance="'+i+'">';export async function page(n){return prefix+await renderToString(()=>Array.from({length:n},(_,i)=>template([open(i),'</section>'],[App()])))+'</main></body></html>';}`,
  );
  const bundle = await rolldown({
    input: resolve(app, label + ".bare-entry.js"),
    cwd: repo,
    platform: "node",
    logLevel: "silent",
    resolve: { conditionNames: ["node", "import", "production", "default"] },
    transform: { define: { "process.env.NODE_ENV": '"production"' } },
  });
  await bundle.write({ file: resolve(app, label + ".ordinary.mjs"), format: "esm", minify: true });
  await bundle.close();
}
console.log("built", app);
