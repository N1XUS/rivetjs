// Local preview of the built site (dist/client, http://127.0.0.1:4321 for apps/docs; example frames are pages of it).
// Watches the sources and rebuilds what a change affects (`tools/watch.ts` → `tools/rebuild.ts`, in a child
// process, into dist/.next/), then swaps the result in while requests wait: the server always answers from one
// complete build, the previous one until the new one is ready (or when it fails).
// `--dev` runs the Vite dev server of the docs app instead (http://127.0.0.1:4320): docs pages and example frames
// compile on demand, with HMR.
//   node libs/docs-kit/cli.ts serve <app root> [--dev] [--no-watch] [--port <n>] [--dist <dir>]
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo, Socket } from "node:net";
import { relative, resolve, sep } from "node:path";
import { closeOnSignals, createListener, serve, type ServerServing } from "@rivetjs/router/node";
import { loadApp } from "./app.ts";
import { readGraph, siteGraphFile } from "./graph.ts";
import { PENDING, STAGING, type RebuildResult } from "./rebuild.ts";
import { changedSince, classify, hasWork, mergePlans, watchSources, type Plan } from "./watch.ts";

const portOf = (origin: string) => Number(new URL(origin).port || 80);

const html = { "content-type": "text/html; charset=utf-8" };

/** Folder → index.html and the 404 page, read from `dir` per request. */
function pages(dir: string) {
  return async (request: Request): Promise<Response> => {
    const { pathname } = new URL(request.url);
    const file = resolve(dir, "." + decodeURIComponent(pathname).replace(/\/?$/, "/") + "index.html");
    if (file.startsWith(dir + sep) && existsSync(file)) return new Response(await readFile(file), { headers: html });
    if (!existsSync(dir))
      return new Response('<!doctype html><meta http-equiv="refresh" content="2"><p>Building the site…</p>', { status: 503, headers: html });
    const missing = resolve(dir, "404.html");
    return new Response(existsSync(missing) ? await readFile(missing) : "Not found", { status: 404, headers: html });
  };
}

/** Static files with folder → index.html and a 404 page (files indexed once at start). */
export async function serveStatic(dir: string, port: number, optional = false) {
  if (!existsSync(dir) && !optional) throw new Error(`${dir} does not exist; run the docs build first`);
  return serve({ client: dir, port, compress: true, immutable: (path) => path.includes("/assets/"), handler: pages(dir) });
}

export interface SwappableServing extends ServerServing {
  /**
   * Run `change` (renames under `dir`) with requests held: in-flight requests finish first, new ones
   * wait, then all of them see the directory after the change. Never a mix of two builds.
   */
  swap(change: () => Promise<void>): Promise<void>;
}

/** Serve `dir` (looked up on disk per request, so it can be replaced while serving) with atomic swaps. */
export async function serveSwappable(dir: string, port: number, host = "127.0.0.1"): Promise<SwappableServing> {
  dir = resolve(dir);
  const make = () =>
    createListener({ client: dir, static: "fs", compress: true, immutable: (path) => path.includes("/assets/"), handler: pages(dir) }).listener;
  let listener = make();
  let gate: Promise<void> | null = null;
  let inflight = 0;
  let idle: (() => void) | null = null;
  const server = createServer({ requestTimeout: 30_000, headersTimeout: 15_000, keepAliveTimeout: 5_000 }, (req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      while (gate) await gate;
      inflight++;
      res.once("close", () => {
        if (--inflight === 0) idle?.();
      });
      listener(req, res);
    })();
  });
  const sockets = new Set<Socket>();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen(port, host, () => {
      server.off("error", fail);
      done();
    });
  });
  const address = server.address() as AddressInfo;
  return {
    server,
    url: `http://${address.address}:${address.port}`,
    async close() {
      await new Promise<void>((done) => {
        server.close(() => done());
        server.closeIdleConnections();
        setTimeout(() => {
          for (const socket of sockets) socket.destroy();
        }, 2_000).unref();
      });
    },
    async swap(change) {
      while (gate) await gate;
      let open!: () => void;
      gate = new Promise<void>((done) => (open = done));
      try {
        if (inflight > 0) await Promise.race([new Promise<void>((done) => (idle = done)), new Promise<void>((done) => setTimeout(done, 10_000).unref())]);
        idle = null;
        await change();
        // A fresh listener: no compressed bodies or resolved paths cached from the previous build.
        listener = make();
      } finally {
        gate = null;
        open();
      }
    },
  };
}

/** Move `staged` to `target`, the previous `target` to `trash` (all inside one dist: plain renames). */
export async function replaceDir(target: string, staged: string, trash: string): Promise<void> {
  if (existsSync(target)) {
    await mkdir(resolve(trash, ".."), { recursive: true });
    await rename(target, trash);
  }
  await mkdir(resolve(target, ".."), { recursive: true });
  await rename(staged, target);
}

interface Options {
  dev: boolean;
  watch: boolean;
  port?: number;
  /** Build output dir (default `<root>/dist`): a second serve next to a running one. Keep it in the repo (bundle externals resolve from node_modules). */
  dist?: string;
}

function parseArgs(args: string[]): Options {
  const value = (name: string) => {
    const at = args.indexOf(name);
    if (at < 0) return undefined;
    const n = Number(args[at + 1]);
    if (!Number.isInteger(n) || n < 0) throw new Error(`docs-kit serve: ${name} needs a port number`);
    return n;
  };
  const port = value("--port");
  const distAt = args.indexOf("--dist");
  const dist = distAt < 0 ? undefined : args[distAt + 1];
  if (distAt >= 0 && (!dist || dist.startsWith("--"))) throw new Error("docs-kit serve: --dist needs a directory");
  return {
    dev: args.includes("--dev"),
    watch: !args.includes("--no-watch"),
    ...(port !== undefined ? { port } : {}),
    ...(dist !== undefined ? { dist } : {}),
  };
}

export const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
export const time = () => new Date().toTimeString().slice(0, 8);
export const list = (items: readonly string[], max = 3) =>
  items.length <= max ? items.join(", ") : `${items.slice(0, max).join(", ")} +${items.length - max} more`;

/** CLI: `docs-kit serve <app root> [--dev] [--no-watch] [--port <n>] [--dist <dir>]`. */
export async function serveCommand(root: string, args: string[]): Promise<void> {
  const { site, repo } = await loadApp(root);
  const options = parseArgs(args);
  const dist = options.dist ? resolve(options.dist) : resolve(root, "dist");
  if (options.dev) {
    // The Vite dev server of the docs app: pages and example frames compile on demand (HMR).
    const started = performance.now();
    const { createServer } = await import("vite");
    const server = await createServer({
      root,
      configFile: resolve(root, "vite.config.ts"),
      // `--dist` may sit anywhere in the app (docsSite() ignores only `dist/` and `.artifacts/`).
      server: { host: "127.0.0.1", ...(options.port ? { port: options.port } : {}), watch: { ignored: [dist + "/**"] } },
    });
    await server.listen();
    console.log(`docs (dev) http://127.0.0.1:${server.config.server.port}  (ready in ${seconds(performance.now() - started)})`);
    const stop = () => void server.close().then(() => process.exit(0));
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
    return;
  }
  if (!options.watch) {
    // Serve what is built (files indexed at start).
    const docs = await serveStatic(resolve(dist, "client"), options.port ?? portOf(site.origin));
    console.log(`docs      ${docs.url}`);
    closeOnSignals(docs);
    return;
  }

  const docs = await serveSwappable(resolve(dist, "client"), options.port ?? portOf(site.origin));
  console.log(`docs      ${docs.url}`);
  console.log(`watching  ${relative(repo, root)} (content, examples, src, config), templates/, libs/  (--no-watch to serve the build as is)`);

  const stampFile = resolve(dist, ".serve-stamp.json");
  const { runRebuild } = await import("./rebuild.ts");
  const graphs = async () => ({ site: await readGraph(siteGraphFile(root)) });

  const pending = new Set<string>();
  let carried: Plan | undefined;
  let running = false;
  // Our own rebuild writes these (api.json): drop their events until shortly after it.
  let quietUntil = 0;
  const own = new Set([resolve(root, "src/generated/api.json")]);

  const swapIn = async (result: RebuildResult): Promise<void> => {
    const staging = resolve(dist, STAGING);
    const trash = resolve(dist, `.trash-${Date.now().toString(36)}`);
    if (result.site)
      await docs.swap(async () => {
        for (const dir of ["client", "server"]) await replaceDir(resolve(dist, dir), resolve(staging, dir), resolve(trash, dir));
      });
    void rm(trash, { recursive: true, force: true });
    await rm(staging, { recursive: true, force: true });
  };

  const cycle = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      while (pending.size || carried) {
        const files = [...pending];
        pending.clear();
        let plan = classify(files, { root, repo, graphs: await graphs() });
        if (carried) plan = mergePlans(carried, plan);
        carried = undefined;
        if (!hasWork(plan)) continue;
        const started = performance.now();
        const startedAt = Date.now();
        const changed = list(plan.changed.length ? plan.changed : ["(startup)"]);
        try {
          const result = await runRebuild(root, plan, { dist });
          await swapIn(result);
          await writeFile(stampFile, JSON.stringify({ built: startedAt }) + "\n");
          await rm(resolve(root, PENDING), { force: true });
          console.log(`[${time()}] rebuilt ${list(result.did, 4)} in ${seconds(performance.now() - started)} (changed: ${changed})`);
        } catch (error) {
          carried = plan;
          const output = (error as { output?: string[] }).output ?? [];
          console.error(`[${time()}] rebuild FAILED after ${seconds(performance.now() - started)} (changed: ${changed}); still serving the previous build`);
          console.error((error as Error).message.split("\n").slice(0, 12).join("\n"));
          if (output.length)
            console.error(
              output
                .slice(-15)
                .map((line) => "  | " + line)
                .join("\n"),
            );
          break; // retried with the next change
        } finally {
          quietUntil = Date.now() + 2_000;
        }
      }
    } finally {
      running = false;
    }
  };

  const watcher = watchSources(root, repo, (files) => {
    for (const file of files) if (!(own.has(file) && (running || Date.now() < quietUntil))) pending.add(file);
    if (pending.size) void cycle();
  });

  // Startup: sources newer than the served build (or no build at all) → rebuild in the background.
  const stamp = await readFile(stampFile, "utf8").then(
    (text) => (JSON.parse(text) as { built: number }).built,
    () => null,
  );
  const builtAt =
    stamp ??
    (await stat(resolve(dist, "client/index.html")).then(
      (info) => info.mtimeMs,
      () => null,
    ));
  let startup: Plan;
  if (builtAt === null || !existsSync(resolve(dist, "client/index.html"))) {
    startup = { changed: [], content: true, api: false, examples: [], site: "full" };
    console.log("no built site: building it (the server answers 503 until it is ready)");
  } else startup = classify(await changedSince(root, repo, builtAt), { root, repo, graphs: await graphs() });
  if (hasWork(startup)) {
    if (startup.changed.length)
      console.log(`stale build: ${startup.changed.length} source file(s) changed since it; serving it while rebuilding in the background`);
    carried = startup;
    void cycle();
  }

  const stop = () => {
    watcher.close();
    void docs.close().then(() => process.exit(0));
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
