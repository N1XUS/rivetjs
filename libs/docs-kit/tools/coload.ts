// Co-load passes of a docs build (BIG-UI-3, `@rivetjs/router` `build/coload.ts`): pass 1 = the ordinary client +
// server build with `RIVET_COLOAD` set (the client build records its chunks), prerendered in a child process; its
// pages give the plan (shared chunks always fetched together → one chunk). Pass 2 = the client bundle again with the
// plan, then the caller prerenders as before. The server bundle is not rebuilt: it reads the client's manifests and
// files at run time (docs-scripts, frame styles, resume manifest), and pass 1's prerender runs in a child because
// that server bundle caches some of them per process. Measured 2026-10-27, ui-docs: pages >= 100 KB gz JS before
// input -3.5 %, every page smaller or equal; build +~45 s (one client build + one prerender).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { COLOAD_ENV, planCoload, prerender, type ColoadReport } from "@rivetjs/router/static";
import { loadBuild } from "../../router/adapters/build.ts";
import { pagePreload } from "../frame-theme.ts";
import { loadApp } from "./app.ts";
import { GENERATED_ENV, viteBuild, type ViteBuildOptions } from "./vite-build.ts";

/** The co-load files of a build (`chunks.json`, `plan.json`): `<dist>/coload`. */
export const coloadDir = (dist: string) => resolve(dist, "coload");
/** Where a built client keeps the plan it was built with (incremental rebuilds reuse it): `.vite/rivet-coload.json`. */
export const USED_PLAN = ".vite/rivet-coload.json";

export interface ColoadBuildOptions extends Omit<ViteBuildOptions, "dist"> {
  dist: string;
  /** Prerender like the site build (`pagePreload(site.leanPages)`); frames-only builds pass `false`. */
  lean: boolean;
  /** A client dir built earlier: build with its plan in one pass (no planning). */
  reuse?: string;
  log: (message: string) => void;
}

/** Client + server build of a docs app with co-load groups (both passes); the caller prerenders the result. */
export async function coloadBuild(root: string, options: ColoadBuildOptions): Promise<void> {
  const { log, lean, reuse, ...vite } = options;
  const dir = coloadDir(options.dist);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const env = { ...vite.env, [COLOAD_ENV]: dir };
  const previous = reuse && resolve(reuse, USED_PLAN);
  if (previous && existsSync(previous)) await copyFile(previous, resolve(dir, "plan.json"));
  await viteBuild(root, { ...vite, env });
  if (!previous && existsSync(resolve(dir, "chunks.json"))) {
    const report = await planChild(root, options.dist, lean);
    log(`coload: ${report.chunks} chunks always loaded together → ${report.groups} groups (${report.pages} pages)`);
    // The compiler's prop-join facts (`@rivetjs/compiler` `vite.ts`, BIG-UI-3): a component no caller passes two joined
    // class props to drops its tailwind-merge import in pass 2.
    const joins = resolve(dir, "class-joins.json");
    const facts = existsSync(joins) ? (JSON.parse(await readFile(joins, "utf8")) as { joins: string[]; needed: string[]; all: boolean }) : null;
    const dropped = facts && !facts.all ? facts.joins.filter((file) => !facts.needed.includes(file)) : [];
    if (dropped.length) log(`coload: tailwind-merge left out of ${dropped.length} prop-join module(s): ${dropped.join(", ")}`);
    if (report.groups || dropped.length) {
      await rm(resolve(options.dist, "client"), { recursive: true, force: true });
      await viteBuild(root, { ...vite, graph: false, clientOnly: true, env: { ...env, [GENERATED_ENV]: "1" } });
    }
  }
  if (existsSync(resolve(dir, "plan.json"))) await copyFile(resolve(dir, "plan.json"), resolve(options.dist, "client", USED_PLAN));
}

/** Pass 1's prerender + plan, in a child process (its server bundle instance and memory go with it). */
function planChild(root: string, dist: string, lean: boolean): Promise<ColoadReport> {
  const args = [...process.execArgv, fileURLToPath(import.meta.url), resolve(root), resolve(dist), lean ? "lean" : "plain"];
  return new Promise((done, fail) => {
    const child = spawn(process.execPath, args, { stdio: ["ignore", "pipe", "inherit"] });
    const stop = () => child.kill();
    process.once("exit", stop);
    let out = "";
    child.stdout!.on("data", (chunk: Buffer) => (out += chunk.toString()));
    child.once("error", fail);
    child.once("exit", (code) => {
      process.off("exit", stop);
      const last = out.trim().split("\n").pop() ?? "";
      if (code === 0 && last.startsWith("{")) done(JSON.parse(last) as ColoadReport);
      else fail(new Error(`docs-kit: co-load planning of ${root} failed (exit code ${code})\n${out.slice(-2000)}`));
    });
  });
}

async function plan(root: string, dist: string, lean: boolean): Promise<ColoadReport> {
  const { site } = await loadApp(root);
  const build = await loadBuild(dist, lean ? { preload: pagePreload(site.leanPages) } : {});
  await prerender({
    handler: build.handler,
    routes: build.entry.routes,
    outDir: build.client,
    origin: site.origin,
    ...(build.entry.base ? { base: build.entry.base } : {}),
    ...(build.entry.trailingSlash ? { trailingSlash: build.entry.trailingSlash } : {}),
    csp: false,
    dictionary: false,
  });
  return planCoload({ dir: coloadDir(dist), client: build.client, ...(build.entry.base ? { base: build.entry.base } : {}) });
}

if (import.meta.main) {
  const [root, dist, mode] = process.argv.slice(2);
  plan(root!, dist!, mode === "lean").then(
    (report) => {
      process.stdout.write(JSON.stringify(report) + "\n", () => process.exit(0));
    },
    (error: unknown) => {
      console.error(error);
      process.exit(1);
    },
  );
}
