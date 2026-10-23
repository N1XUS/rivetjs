// `check-examples <app> <id…>`: production check of a few examples without the whole site. One Vite build of the
// docs app restricted to the chosen frame pages (`vite.ts` frames-only transforms: no docs pages, other frames out
// of the graph), prerender of those pages, their Chromium checks (no cache, the site's check cache untouched).
// Output: `<app>/.artifacts/check-examples/` (never the app's dist).
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { prerender } from "@rivetjs/router/static";
import { loadBuild } from "../../router/adapters/build.ts";
import { framePath } from "../frame-theme.ts";
import type { ExampleData } from "../components/types.ts";
import { FRAMES_ONLY_ENV } from "../vite.ts";
import { loadApp } from "./app.ts";
import { generateContent } from "./content/generate.ts";
import { EXAMPLES_JSON, generateExamples } from "./examples.ts";
import { mb, memoryBudget, watchMemory } from "./memory.ts";
import { viteBuild } from "./vite-build.ts";

export const CHECK_EXAMPLES_DIST = ".artifacts/check-examples";

export interface CheckOnlyOptions {
  /** Output dir (default `<root>/.artifacts/check-examples`). */
  dist?: string;
  log?: (message: string) => void;
}

/** A frames-only production build of some examples (`buildFrames`), prerendered. */
export interface FramesBuild {
  dist: string;
  /** The loaded server build (`loadBuild`): `handler`, `client` dir, `entry`. */
  build: Awaited<ReturnType<typeof loadBuild>>;
  origin: string;
  pages: number;
  /** Phase times (`performance.now()`). */
  started: number;
  vite: number;
  rendered: number;
}

/** Build the frame pages of `ids` (one Vite build restricted to them, child processes) and prerender them. */
export async function buildFrames(root: string, ids: readonly string[], options: CheckOnlyOptions = {}): Promise<FramesBuild> {
  const { site } = await loadApp(root);
  const log = options.log ?? ((message: string) => console.log(message));
  const started = performance.now();
  const dist = resolve(options.dist ?? resolve(root, CHECK_EXAMPLES_DIST));
  const { examples } = await generateExamples(root);
  const unknown = ids.filter((id) => !examples[id]);
  if (unknown.length) throw new Error(`check-examples: unknown example(s) ${unknown.join(", ")}`);
  const code = ids.filter((id) => examples[id]!.codeOnly);
  if (code.length) throw new Error(`check-examples: code-only example(s) ${code.map((id) => `${id} (${examples[id]!.codeOnly})`).join(", ")}`);
  // Kit route copies (frame routes) + the generated layout's nav: the router scans them.
  // Lenient: a half-written page of another edit must not block example checks (the content is not built here).
  await generateContent(root, { lenient: (message) => log(`docs: ${message}`) });
  for (const dir of ["client", "server"]) await rm(resolve(dist, dir), { recursive: true, force: true });
  // Child process (`vite-build.ts`): the build's memory is released before the Chromium checks.
  await viteBuild(root, { dist, env: { [FRAMES_ONLY_ENV]: ids.join(",") } });
  const vite = performance.now();
  const build = await loadBuild(dist);
  const report = await prerender({
    handler: build.handler,
    routes: build.entry.routes,
    outDir: build.client,
    origin: site.origin,
    ...(build.entry.base ? { base: build.entry.base } : {}),
    ...(build.entry.trailingSlash ? { trailingSlash: build.entry.trailingSlash } : {}),
    // Example checks only: no compression dictionaries.
    dictionary: false,
  });
  return { dist, build, origin: site.origin, pages: report.pages.length, started, vite, rendered: performance.now() };
}

/** Build the frame pages of `ids` and run their checks; throws on a failed (non-quarantined) check. */
export async function checkExamplesOnly(root: string, ids: readonly string[], options: CheckOnlyOptions = {}): Promise<void> {
  const log = options.log ?? ((message: string) => console.log(message));
  const memory = watchMemory();
  let frames: FramesBuild | undefined;
  const seconds = (from: number, to: number) => ((to - from) / 1000).toFixed(1) + " s";
  try {
    frames = await buildFrames(root, ids, options);
    const { build } = frames;
    const { checkExamples } = await import("./example-checks.ts");
    const all = JSON.parse(await readFile(resolve(root, EXAMPLES_JSON), "utf8")) as Record<string, ExampleData>;
    const measures = await checkExamples(root, build.client, all, { only: ids, cache: false, persist: false, log });
    const kb = (bytes: number) => (bytes / 1024).toFixed(1) + " KB";
    for (const [id, m] of Object.entries(measures))
      log(`measure ${id}: before ${m.requestsBefore} scripts / ${kb(m.bytesBefore)}, first input +${m.requestsAfter} / ${kb(m.bytesAfter)}`);
  } finally {
    const peak = await memory.stop();
    const budget = memoryBudget();
    if (frames)
      log(
        `check-examples: ${ids.length} example(s), ${frames.pages} page(s); vite ${seconds(frames.started, frames.vite)}, prerender ${seconds(frames.vite, frames.rendered)}, ` +
          `checks ${seconds(frames.rendered, performance.now())}; peak tree RSS ${mb(peak)} (budget ${budget ? budget + " MB" : "off"})`,
      );
    if (budget && peak > budget * 1024 * 1024) throw new Error(`check-examples: peak memory ${mb(peak)} is over the ${budget} MB budget (DOCS_KIT_MAX_RSS_MB)`);
  }
}

/** `node libs/docs-kit/cli.ts check-examples <app> <id…> [--dist dir]` */
export async function checkExamplesCommand(root: string, args: readonly string[]): Promise<void> {
  const ids: string[] = [];
  let dist: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dist") dist = args[++i];
    else ids.push(...args[i]!.split(",").filter(Boolean));
  }
  if (!ids.length) throw new Error("usage: docs-kit check-examples <app root> <example id…> [--dist dir]");
  await checkExamplesOnly(root, ids, dist ? { dist: resolve(dist) } : {});
}
