// Co-load chunk groups (BIG-UI-3, 2026-10-27): a two-pass client build that merges shared chunks the prerendered pages
// always load together. Pass 1 (env `RIVET_COLOAD` = a directory) records the client chunks (`chunks.json`: modules,
// entry flag, imports); the orchestrator prerenders it and calls `planCoload`, which reads every page's scripts fetched
// before input (`<script src>`, modulepreload, the resume state's `data-fo`) and writes `plan.json`: groups of shared
// (non-entry) chunks with the same set of pages that fetch them before input AND the same set of pages that can reach
// them at all (static + dynamic imports), so no page loads a byte more, before or after input. A group never puts an
// outside chunk on an import path between two members (a chunk cycle would change evaluation order). Pass 2 (same env,
// `plan.json` present) captures each group's modules into one chunk (`codeSplitting.groups`, dependencies not
// captured). Without the env the plugin does nothing (zero cost). docs-kit builds run both passes (`tools/coload.ts`).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Plugin } from "vite";

/** Env of a co-load build: the directory holding `chunks.json` (written by the client build) and `plan.json` (read). */
export const COLOAD_ENV = "RIVET_COLOAD";
/** Client chunks of the build (written into the `RIVET_COLOAD` dir). */
export const COLOAD_CHUNKS = "chunks.json";
/** Groups the client build applies (read from the `RIVET_COLOAD` dir). */
export const COLOAD_PLAN = "plan.json";

/** One recorded client chunk. Module ids are root-relative (virtual ids as they are). */
export interface ColoadChunk {
  modules: string[];
  /** Entry or dynamic entry: loaded by URL, never grouped. */
  entry: boolean;
  /** Chunk files it imports (static and dynamic). */
  imports: string[];
  /** Code bytes. */
  size: number;
}
/** `chunks.json`: chunk file (outDir-relative) → record. */
export interface ColoadChunks {
  v: 1;
  chunks: Record<string, ColoadChunk>;
}
/** `plan.json`: each group's chunk name and the modules it captures. */
export interface ColoadPlan {
  v: 1;
  groups: { name: string; modules: string[] }[];
}

const toId = (root: string, id: string) => (isAbsolute(id) ? relative(root, id).split(sep).join("/") : id);

/**
 * The co-load plugin of `rivetRouter()` (client build only): inert unless `RIVET_COLOAD` is set. Then it records the
 * client chunks into `<dir>/chunks.json` and, when `<dir>/plan.json` exists, merges each planned group into one chunk.
 */
export function coloadPlugin(): Plugin {
  const dir = process.env[COLOAD_ENV];
  if (!dir) return { name: "vite-plugin-rivet-coload" };
  let root = process.cwd();
  return {
    name: "vite-plugin-rivet-coload",
    apply: "build",
    config(config) {
      root = resolve(config.root ?? process.cwd());
      const file = join(dir, COLOAD_PLAN);
      if (!existsSync(file)) return;
      const plan = JSON.parse(readFileSync(file, "utf8")) as ColoadPlan;
      const group = new Map<string, string>();
      for (const { name, modules } of plan.groups) for (const id of modules) group.set(id, name);
      if (!group.size) return;
      const name = (id: string) => group.get(toId(root, id)) ?? null;
      return {
        environments: {
          client: {
            build: {
              rolldownOptions: {
                output: { codeSplitting: { groups: [{ name, test: (id: string) => name(id) !== null, includeDependenciesRecursively: false }] } },
              },
            },
          },
        },
      };
    },
    configResolved(config) {
      root = config.root;
    },
    generateBundle: {
      order: "post",
      handler(_options, bundle) {
        if (this.environment?.config?.consumer !== "client") return;
        const chunks: Record<string, ColoadChunk> = {};
        for (const output of Object.values(bundle))
          if (output.type === "chunk")
            chunks[output.fileName] = {
              modules: output.moduleIds.map((id) => toId(root, id)),
              entry: output.isEntry || output.isDynamicEntry,
              imports: [...output.imports, ...output.dynamicImports],
              size: Buffer.byteLength(output.code),
            };
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, COLOAD_CHUNKS), JSON.stringify({ v: 1, chunks } satisfies ColoadChunks));
      },
    },
  };
}

const SCRIPT_URL = /<(?:script\b[^>]*?\ssrc|link\b[^>]*?\srel="?modulepreload"?[^>]*?\shref)="([^"]+)"/g;
const STATE_TAG = /<script type="rivet\/boundaries"([^>]*)>/g;
const attr = (attrs: string, name: string) => new RegExp(`\\s${name}="([^"]*)"`).exec(attrs)?.[1];

/** Script URLs a prerendered page fetches before input: `<script src>`, modulepreload links, the resume state's `data-fo`. */
export function pageScripts(html: string): string[] {
  const urls = [...html.matchAll(SCRIPT_URL)].map((m) => m[1]!);
  for (const [, attrs] of html.matchAll(STATE_TAG)) {
    // `data-ab`: entries without a `/` are short (base + entry + ".js").
    const ab = attr(attrs!, "data-ab");
    for (const u of (attr(attrs!, "data-fo") ?? "").split(" ")) if (u) urls.push(ab && !u.includes("/") ? ab + u + ".js" : u);
  }
  return urls;
}

/** What `planCoload` found. */
export interface ColoadReport {
  pages: number;
  groups: number;
  /** Chunks merged into the groups. */
  chunks: number;
}

/**
 * Plan the co-load groups of a recorded client build (`<dir>/chunks.json`) from its prerendered pages (every `.html`
 * under `client`), and write `<dir>/plan.json`. `base`: the client build's URL base path (`/app`).
 */
export async function planCoload(options: { dir: string; client: string; base?: string }): Promise<ColoadReport> {
  const { chunks } = JSON.parse(await readFile(join(options.dir, COLOAD_CHUNKS), "utf8")) as ColoadChunks;
  const base = (options.base ?? "").replace(/\/+$/, "");
  const files = (await readdir(options.client, { recursive: true })).filter((file) => file.endsWith(".html")).sort();
  // Chunk → indexes of the pages fetching it before input / reaching it at all.
  const before = new Map<string, number[]>(),
    reached = new Map<string, number[]>();
  const add = (map: Map<string, number[]>, file: string, page: number) => {
    const list = map.get(file);
    if (!list) map.set(file, [page]);
    else if (list[list.length - 1] !== page) list.push(page);
  };
  let pages = 0;
  for (const file of files) {
    const html = await readFile(join(options.client, file), "utf8");
    const own = new Set<string>();
    for (const url of pageScripts(html)) {
      if (!url.startsWith("/") || url.startsWith("//")) continue;
      const path = (base && url.startsWith(base + "/") ? url.slice(base.length) : url).slice(1).split(/[?#]/)[0]!;
      if (chunks[path]) own.add(path);
    }
    if (!own.size) continue;
    const page = pages++;
    for (const chunk of [...own].sort()) add(before, chunk, page);
    const stack = [...own],
      seen = new Set<string>();
    while (stack.length) {
      const next = stack.pop()!;
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(...(chunks[next]?.imports ?? []));
    }
    for (const chunk of [...seen].sort()) add(reached, chunk, page);
  }
  // Static + dynamic import closure per chunk (cycle check).
  const closures = new Map<string, Set<string>>();
  const closure = (file: string): Set<string> => {
    let seen = closures.get(file);
    if (seen) return seen;
    seen = new Set();
    const stack = [...(chunks[file]?.imports ?? [])];
    while (stack.length) {
      const next = stack.pop()!;
      if (seen.has(next)) continue;
      seen.add(next);
      stack.push(...(chunks[next]?.imports ?? []));
    }
    closures.set(file, seen);
    return seen;
  };
  const sets = new Map<string, string[]>();
  for (const [file, list] of before) {
    if (chunks[file]!.entry) continue;
    const key = list.join(",") + "|" + reached.get(file)!.join(",");
    const members = sets.get(key);
    if (members) members.push(file);
    else sets.set(key, [file]);
  }
  const groups: string[][] = [];
  for (const members of sets.values()) {
    if (members.length < 2) continue;
    // Largest first (it names the group), then by file name: deterministic.
    members.sort((a, b) => chunks[b]!.size - chunks[a]!.size || (a < b ? -1 : 1));
    // Greedy: a member joins the first group where no chunk outside the group sits on an import path between two of its chunks.
    const parts: string[][] = [];
    for (const file of members) {
      const fits = (part: string[]) => {
        const all = [...part, file],
          inside = new Set(all);
        for (const a of all) for (const x of closure(a)) if (!inside.has(x) && all.some((b) => closure(x).has(b))) return false;
        return true;
      };
      const part = parts.find(fits);
      if (part) part.push(file);
      else parts.push([file]);
    }
    groups.push(...parts.filter((part) => part.length > 1));
  }
  groups.sort((a, b) => (a[0]! < b[0]! ? -1 : 1));
  const names = new Set<string>();
  const plan: ColoadPlan = {
    v: 1,
    groups: groups.map((group) => {
      // The largest member's chunk name (`assets/focus-ring-<hash>.js` → `focus-ring`), made unique.
      const stem = group[0]!
        .replace(/^.*\//, "")
        .replace(/-[\w-]{8}\.js$/, "")
        .replace(/\.js$/, "");
      let name = stem;
      for (let i = 2; names.has(name); i++) name = `${stem}-${i}`;
      names.add(name);
      return { name, modules: group.flatMap((file) => chunks[file]!.modules) };
    }),
  };
  await writeFile(join(options.dir, COLOAD_PLAN), JSON.stringify(plan) + "\n");
  return { pages, groups: plan.groups.length, chunks: groups.reduce((n, group) => n + group.length, 0) };
}
