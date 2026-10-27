// Live-test the ui stories: `node libs/ui/tests-components/app/serve.ts` (production build + node adapter,
// resumed pages) or `--dev` (Vite dev server). PORT defaults to 4330. `--build client|server`: one bundle only, then
// exit (the child side of `buildAppInChild`).
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build, createServer } from "vite";
import { closeOnSignals, start } from "@rivetjs/router/node";
import { genVisual } from "./gen-visual.ts";

const root = fileURLToPath(new URL("./", import.meta.url));
const configFile = root + "vite.config.ts";
const self = fileURLToPath(import.meta.url);

/** Output directory (`STORIES_DIST` overrides `dist`, so parallel test runs don't share one). */
export const dist = root + (process.env.STORIES_DIST ?? "dist");

/** V8 old-space cap (MB) of each build child (env `STORIES_BUILD_HEAP_MB` overrides). */
export const BUILD_HEAP_MB = 1536;

async function buildClient(): Promise<void> {
  await rm(dist, { recursive: true, force: true });
  await genVisual();
  await build({ root, configFile, logLevel: "warn", build: { outDir: dist + "/client" } });
}

async function buildServer(): Promise<void> {
  await build({ root, configFile, logLevel: "warn", build: { ssr: true, outDir: dist + "/server" } });
}

/** Client + server builds into `dist/`, in this process (the Vite graph and rolldown's native heap stay resident). */
export async function buildApp(): Promise<void> {
  await buildClient();
  await buildServer();
}

/**
 * `buildApp()` in two child processes, client then server (as `vite build && vite build --ssr`): rolldown's native
 * heap and the module graph are not given back to the OS after a build, so an in-process build kept ~1.5 GB resident in
 * the caller (the Vitest main process) for the whole run, under every test file's fork and Chromium. Each child exits
 * when its bundle is written; V8 heap capped at `BUILD_HEAP_MB`. Production build: `NODE_ENV=test` is dropped.
 */
export async function buildAppInChild(): Promise<void> {
  await child("client");
  await child("server");
}

function child(bundle: "client" | "server"): Promise<void> {
  const heap = Number(process.env.STORIES_BUILD_HEAP_MB) || BUILD_HEAP_MB;
  const env = { ...process.env };
  if (env.NODE_ENV === "test") delete env.NODE_ENV;
  return new Promise((done, fail) => {
    const proc = spawn(process.execPath, [`--max-old-space-size=${heap}`, self, "--build", bundle], { stdio: "inherit", env });
    const stop = () => proc.kill();
    process.once("exit", stop);
    proc.once("error", fail);
    proc.once("exit", (code, signal) => {
      process.off("exit", stop);
      if (code === 0) done();
      else fail(new Error(`ui stories: ${bundle} build failed (${signal ? "signal " + signal : "exit code " + code})`));
    });
  });
}

if (process.argv[1] && self === process.argv[1]) {
  const port = Number(process.env.PORT ?? 4330);
  const only = process.argv.indexOf("--build");
  if (only >= 0) {
    await (process.argv[only + 1] === "server" ? buildServer() : buildClient());
    process.exit(0); // the build may leave handles (watchers, workers) open
  } else if (process.argv.includes("--dev")) {
    await genVisual();
    const vite = await createServer({ root, configFile, server: { port, host: "127.0.0.1" } });
    await vite.listen();
    console.log(`ui stories (dev): ${vite.resolvedUrls!.local[0]}`);
  } else {
    await buildApp();
    const app = await start({ dist, port, host: "127.0.0.1" });
    closeOnSignals(app);
    console.log(`ui stories: ${app.url}`);
  }
}
