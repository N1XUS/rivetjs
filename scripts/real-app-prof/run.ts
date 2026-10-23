// Real-app SSR profiler: builds the playground and generated N-route apps as production
// (Vite + rivetRouter, resumable SSR) into `.artifacts/real-app/<app>/`, then drives the built
// handler in-process (Request → body drained) and reports µs/req, allocated KB/req, body KB,
// state KB and the eager App chunk (min / brotli) + whether the page boots the runtime at idle.
//
//   node scripts/real-app-prof/run.ts [--apps=playground,routes-10,routes-100,routes-500,starter-minimal] [--no-build]
//        [--requests=4000] [--path=/] [--cpu-prof] [--json=<file>]
//
// `--cpu-prof` re-runs the measured loop of each app under `node --cpu-prof` (profiles in
// `.artifacts/real-app/<app>/prof/`) and prints the top self-time functions.
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { brotliCompressSync } from "node:zlib";
import { spawnSync } from "node:child_process";
import { getHeapStatistics } from "node:v8";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const out = resolve(repo, ".artifacts/real-app");
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key!, value];
  }),
);
const apps = (args.get("apps") ?? "playground,routes-10,routes-100,routes-500").split(",");
const requests = Number(args.get("requests") ?? 4000);
const path = args.get("path") ?? "/";

// ---------------------------------------------------------------- staging

async function stagePlayground(dir: string): Promise<void> {
  const src = resolve(repo, "apps/playground");
  await rm(resolve(dir, "src"), { recursive: true, force: true });
  await cp(resolve(src, "src"), resolve(dir, "src"), { recursive: true });
  for (const file of ["vite.config.ts", "types.d.ts"]) await cp(resolve(src, file), resolve(dir, file));
  // One level deeper than apps/playground: re-point `extends`.
  const tsconfig = (await readFile(resolve(src, "tsconfig.json"), "utf8")).replace('"../../tsconfig.base.json"', '"../../../tsconfig.base.json"');
  await writeFile(resolve(dir, "tsconfig.json"), tsconfig);
}

/** A file-routed app with `count` page routes: a root layout (counter + nav Links), `/` (loader, For of Links,
 * model input), one param route, the rest small static pages with a loader, a Link and a handler. */
async function stageRoutes(dir: string, count: number): Promise<void> {
  await rm(resolve(dir, "src"), { recursive: true, force: true });
  const routes = resolve(dir, "src/routes");
  await mkdir(resolve(routes, "p"), { recursive: true });
  await mkdir(resolve(routes, "items"), { recursive: true });
  await writeFile(
    resolve(dir, "vite.config.ts"),
    `import { defineConfig } from "vite";\nimport { rivetRouter } from "@rivetjs/router/vite";\nexport default defineConfig({ plugins: [rivetRouter({})] });\n`,
  );
  await writeFile(resolve(dir, "tsconfig.json"), JSON.stringify({ extends: "../../../tsconfig.base.json", include: ["src/**/*.ts", "src/**/*.tsx"] }));
  await writeFile(
    resolve(dir, "src/document.ts"),
    `import { headTags, type DocumentShell } from "@rivetjs/router/server";
const document: DocumentShell = ({ head, styles }) => ({
  start: '<!doctype html><html lang="en"><head><meta charset="utf-8">' + headTags({ title: head?.title ?? "Routes", ...(head?.meta ? { meta: head.meta } : {}) }) +
    styles.map((href) => '<link rel="stylesheet" href="' + href + '">').join("") + '</head><body><div id="app">',
  end: "</div></body></html>",
});
export default document;
`,
  );
  await writeFile(
    resolve(routes, "_layout.tsx"),
    `import { signal } from "@rivetjs/reactivity";
import type { LayoutProps } from "@rivetjs/router";
import { Link } from "@rivetjs/router/client";
export default function Layout({ children }: LayoutProps) {
  const count = signal(0);
  return (
    <main class="app">
      <nav><Link to="/">Home</Link> <Link to="/p/r1">One</Link> <Link to="/items/1">Item</Link></nav>
      <button type="button" onClick={() => count.update((v) => v + 1)}>Count</button> <output>{count()}</output>
      {children}
    </main>
  );
}
`,
  );
  await writeFile(
    resolve(routes, "index.tsx"),
    `import { signal } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { load, type PageProps } from "@rivetjs/router";
import { Link } from "@rivetjs/router/client";
export const head = { title: "Home" };
export const loader = load(() => Array.from({ length: 6 }, (_, i) => ({ id: String(i + 1), title: "Item " + (i + 1), description: "Description of item " + (i + 1) })));
export default function Home({ data }: PageProps<typeof loader>) {
  const query = signal("");
  return (
    <section>
      <h1>Explore</h1>
      <input type="search" model:value={query} placeholder="Search" />
      <ul>
        <For each={() => data.filter((item) => item.title.toLowerCase().includes(query().toLowerCase()))} by={(item) => item.id}>
          {(item) => (
            <li class="card">
              <Link class="link" to={"/items/" + encodeURIComponent(item().id)}>{item().title}</Link>
              <p>{item().description}</p>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}
`,
  );
  await writeFile(
    resolve(routes, "items/[id].tsx"),
    `import { load, type PageProps, type RequestEvent } from "@rivetjs/router";
import { Link } from "@rivetjs/router/client";
export const loader = load(({ params }: RequestEvent<{ id: string }>) => ({ id: params.id, title: "Item " + params.id }));
export default function Item({ data }: PageProps<typeof loader, { id: string }>) {
  return <article><Link to="/">Back</Link><h1>{data.title}</h1></article>;
}
`,
  );
  for (let i = 1; i <= count - 2; i++)
    await writeFile(
      resolve(routes, "p/r" + i + ".tsx"),
      `import { signal } from "@rivetjs/reactivity";
import { load, type PageProps } from "@rivetjs/router";
import { Link } from "@rivetjs/router/client";
export const loader = load(() => ({ n: ${i} }));
export default function R${i}({ data }: PageProps<typeof loader>) {
  const hits = signal(0);
  return (
    <section>
      <h1>Route {data.n}</h1>
      <Link to="/p/r${(i % (count - 2)) + 1}">Next</Link>
      <button type="button" onClick={() => hits.update((v) => v + 1)}>Hit {hits()}</button>
    </section>
  );
}
`,
    );
}

/** A starter template (`templates/<name>`), copied as is (self-contained tsconfig). */
async function stageTemplate(dir: string, name: string): Promise<void> {
  const src = resolve(repo, "templates", name);
  await rm(resolve(dir, "src"), { recursive: true, force: true });
  await cp(resolve(src, "src"), resolve(dir, "src"), { recursive: true });
  for (const file of ["vite.config.ts", "tsconfig.json"]) await cp(resolve(src, file), resolve(dir, file));
}

async function build(app: string, dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  if (app === "playground") await stagePlayground(dir);
  else if (app.startsWith("starter-")) await stageTemplate(dir, app);
  else await stageRoutes(dir, Number(app.split("-")[1]));
  await rm(resolve(dir, "dist"), { recursive: true, force: true });
  const { createBuilder } = await import("vite");
  const builder = await createBuilder({
    root: dir,
    configFile: resolve(dir, "vite.config.ts"),
    logLevel: "warn",
    builder: {},
    build: { minify: true },
    environments: {
      ssr: { build: { outDir: "dist/server", manifest: false, minify: false, rollupOptions: { input: resolve(dir, ".rivet/entry.server.tsx") } } },
    },
  });
  await builder.buildApp();
}

// ---------------------------------------------------------------- measuring

interface Result {
  app: string;
  usPerReq: number;
  allocKB: number;
  bodyKB: number;
  stateKB: number;
  lazyKB: number;
  boot: boolean;
  appMinKB: number;
  appBrKB: number;
  eagerMinKB: number;
  eagerBrKB: number;
}

async function measure(app: string, dir: string, loop = requests): Promise<Result> {
  const { loadBuild } = (await import(
    pathToFileURL(resolve(repo, "libs/router/adapters/build.ts")).href
  )) as typeof import("../../libs/router/adapters/build.ts");
  const { handler } = await loadBuild(resolve(dir, "dist"), { onError: (error) => console.error(error) });
  const url = "http://localhost" + path;
  const once = async (): Promise<string> => {
    const response = await handler(new Request(url, { headers: { accept: "text/html" } }));
    return response.text();
  };
  const html = await once();
  for (let i = 0; i < Math.min(2000, loop); i++) await once();
  (globalThis as { gc?: () => void }).gc?.();
  const runs: number[] = [];
  let alloc = 0;
  for (let round = 0; round < 5; round++) {
    const a0 = getHeapStatistics().total_allocated_bytes;
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < loop / 5; i++) await once();
    runs.push(Number(process.hrtime.bigint() - t0) / 1e3 / (loop / 5));
    alloc += (getHeapStatistics().total_allocated_bytes - a0) / (loop / 5);
  }
  runs.sort((a, b) => a - b);
  const state = /<script type="rivet\/boundaries"([^>]*)>([^<]*)/.exec(html);
  const json = state ? JSON.parse(state[2]!.replace(/\\u003c/g, "<")) : {};
  // Eager JS: the generated App's chunk (route-count driven) and, when the page boots, the chunks
  // the runtime when the page boots (`data-boot`).
  const client = resolve(dir, "dist/client");
  const manifest = JSON.parse(await readFile(resolve(client, ".vite/rivet-resume.json"), "utf8")) as { symbols: Record<string, string>; runtime: string };
  const appChunk = Object.entries(manifest.symbols).find(([id]) => id.startsWith(".rivet/app.tsx#App"))?.[1];
  const size = async (file: string | undefined) => {
    if (!file) return [0, 0];
    const bytes = await readFile(resolve(client, file.replace(/^\//, "")));
    return [bytes.length / 1024, brotliCompressSync(bytes).length / 1024];
  };
  const [appMin, appBr] = await size(appChunk);
  const boot = !!state && / data-boot/.test(state[1]!);
  let eagerMin = 0,
    eagerBr = 0;
  if (boot) {
    // A booting page (`data-boot`) loads the runtime (`data-rt`) at load; closure over the Vite manifest's static imports.
    const rt = / data-rt="([^"]*)"/.exec(state![1]!)?.[1];
    const vite = JSON.parse(await readFile(resolve(client, ".vite/manifest.json"), "utf8")) as Record<string, { file: string; imports?: string[] }>;
    const importsOf = new Map(Object.values(vite).map((record) => ["/" + record.file, (record.imports ?? []).map((key) => "/" + vite[key]!.file)]));
    const files = new Set<string>();
    const add = (file: string) => {
      if (files.has(file)) return;
      files.add(file);
      for (const next of importsOf.get(file) ?? []) add(next);
    };
    add(rt ?? manifest.runtime);
    for (const file of files) {
      const [m, b] = await size(file);
      eagerMin += m!;
      eagerBr += b!;
    }
  }
  return {
    app,
    usPerReq: runs[2]!,
    allocKB: alloc / 5 / 1024,
    bodyKB: Buffer.byteLength(html) / 1024,
    stateKB: state ? Buffer.byteLength(state[2]!) / 1024 : 0,
    lazyKB: json.d ? JSON.stringify(json.d).length / 1024 : 0,
    boot,
    appMinKB: appMin!,
    appBrKB: appBr!,
    eagerMinKB: eagerMin,
    eagerBrKB: eagerBr,
  };
}

function topSelf(profileDir: string): Promise<string> {
  return readdir(profileDir).then(async (files) => {
    const file = files
      .filter((f) => f.endsWith(".cpuprofile"))
      .sort()
      .at(-1);
    if (!file) return "no profile";
    const profile = JSON.parse(await readFile(resolve(profileDir, file), "utf8")) as {
      nodes: { id: number; callFrame: { functionName: string; url: string; lineNumber: number } }[];
      samples: number[];
    };
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const self = new Map<string, number>();
    for (const id of profile.samples) {
      const frame = byId.get(id)!.callFrame;
      const key = (frame.functionName || "(anon)") + " " + frame.url.split("/").slice(-2).join("/") + ":" + (frame.lineNumber + 1);
      self.set(key, (self.get(key) ?? 0) + 1);
    }
    const total = profile.samples.length;
    return [...self]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([key, n]) => ((100 * n) / total).toFixed(1).padStart(5) + "%  " + key)
      .join("\n");
  });
}

// ---------------------------------------------------------------- main

if (args.has("child")) {
  // `--cpu-prof` child: measure only.
  const app = args.get("child")!;
  console.log(JSON.stringify(await measure(app, resolve(out, app))));
  process.exit(0);
}

const results: Result[] = [];
for (const app of apps) {
  const dir = resolve(out, app);
  if (!args.has("no-build") || !existsSync(resolve(dir, "dist/server/entry.server.js"))) await build(app, dir);
  const result = await measure(app, dir);
  results.push(result);
  if (args.has("cpu-prof")) {
    const prof = resolve(dir, "prof");
    await rm(prof, { recursive: true, force: true });
    spawnSync(
      process.execPath,
      ["--cpu-prof", "--cpu-prof-dir=" + prof, fileURLToPath(import.meta.url), "--child=" + app, "--requests=" + requests, "--path=" + path],
      {
        stdio: ["ignore", "ignore", "inherit"],
      },
    );
    console.log("\n== " + app + " top self ==\n" + (await topSelf(prof)));
  }
}
const f = (n: number, d = 1) => n.toFixed(d);
console.log("\n| app | µs/req | alloc KB | body KB | state KB | state.d KB | boot | App chunk min/br KB | eager JS min/br KB |");
console.log("|---|---|---|---|---|---|---|---|---|");
for (const r of results)
  console.log(
    `| ${r.app} | ${f(r.usPerReq)} | ${f(r.allocKB)} | ${f(r.bodyKB, 2)} | ${f(r.stateKB, 2)} | ${f(r.lazyKB, 2)} | ${r.boot ? "yes" : "no"} | ${f(r.appMinKB)} / ${f(r.appBrKB)} | ${f(r.eagerMinKB)} / ${f(r.eagerBrKB)} |`,
  );
if (args.has("json")) await writeFile(resolve(args.get("json")!), JSON.stringify(results, null, 2));
process.exit(0);
