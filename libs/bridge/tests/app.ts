// The fixture app (`fixtures/app`: a Rivet page with fake-framework islands) copied into a fresh `.artifacts` root
// inside the repo (so `@rivetjs/*` resolve through the workspace) for Vite builds and dev servers.
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Plugin } from "vite";
import type { BridgeEntry } from "@rivetjs/compiler/vite";

export interface FixtureApp {
  root: string;
  /** The app's `fake()` bridge entry factory (its own copy of `fake/vite.js`). */
  fake(options?: {
    include?: string[];
    exclude?: string[];
    dedupe?: string[];
    islands?: { include?: string[]; exclude?: string[] };
  }): BridgeEntry & { plugins(): Plugin[] };
  seen: Set<string>;
  remove(): Promise<void>;
}

export async function fixtureApp(name: string): Promise<FixtureApp> {
  await mkdir(".artifacts", { recursive: true });
  const root = await mkdtemp(resolve(".artifacts/bridge-" + name + "-"));
  await cp(fileURLToPath(new URL("./fixtures/app", import.meta.url)), root, { recursive: true });
  const mod = (await import(pathToFileURL(resolve(root, "fake/vite.js")).href)) as { fake: FixtureApp["fake"]; seen: Set<string> };
  return { root, fake: mod.fake, seen: mod.seen, remove: () => rm(root, { recursive: true, force: true }) };
}
