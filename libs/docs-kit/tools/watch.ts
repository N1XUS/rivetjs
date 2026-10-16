// Change detection for `serve`: which source files a site depends on, and what a batch of changed files
// requires (`classify` → `Plan`). Watched: the app's content/, examples/, src/ (hand-written), its
// config files, the repo's templates/ and libs/. Library changes reach the site through the module graph
// recorded by its last build (`graph.ts`). Examples are modules of the site (frame routes), so they rebuild with it.
import { watch, type FSWatcher } from "node:fs";
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

export type SiteWork = "none" | "pages" | "full";

/** What a batch of changes requires. */
export interface Plan {
  /** Changed sources, repo-relative (for the log line). */
  changed: string[];
  /** Regenerate content routes (`generateContent`). */
  content: boolean;
  /** Regenerate `src/generated/api.json` (TypeDoc). */
  api: boolean;
  /** Examples whose sources changed (regenerated; their pages re-rendered). */
  examples: string[];
  /** Site: nothing, the affected pages (decided after content generation), or every page. */
  site: SiteWork;
}

export interface Graphs {
  /** Site module graph (repo-relative); undefined = never recorded (library changes rebuild the site). */
  site: ReadonlySet<string> | undefined;
}

const posix = (path: string) => path.split(sep).join("/");
const order: Record<SiteWork, number> = { none: 0, pages: 1, full: 2 };
const atLeast = (a: SiteWork, b: SiteWork): SiteWork => (order[b] > order[a] ? b : a);

/** App files written by the build itself (never sources). Paths relative to the app root. */
const APP_GENERATED =
  /^(dist|\.artifacts|\.rivet|node_modules|src\/routes\/\(docs\))(\/|$)|^src\/generated\/(?!api\.json$)|^src\/routes\/(search\.tsx|examples\/|api\/)/;
/** Library files no build reads. Paths relative to libs/<name>/. */
const LIB_IGNORED = /(^|\/)(node_modules|dist|tests?|\.rivet|\.artifacts|target|coverage)(\/|$)|\.test\.[cm]?[jt]sx?$|\.md$|^compiler\/(rust|oracle)\//;
/** Library files that are build tooling (Vite plugins, the compiler, docs-kit tools): not in any module graph, they shape every site build. */
const TOOLING = /^libs\/(compiler\/|docs-kit\/(tools\/|vite\.ts$)|router\/(build|adapters)\/|[^/]+\/vite(\.ts$|\/))/;
const APP_CONFIG = new Set(["site.config.ts", "vite.config.ts", "tsconfig.json", "package.json"]);
/**
 * Editor / tool temp files: hidden (`.!123!menu.md` from sed -i, `.#x`, `.x.swp`, `.DS_Store`), `#x`, `x~`;
 * atomic-write temps renamed over the target right after (`x.tsx.tmp.<pid>.<hash>` from agent/editor
 * writes, `x.<pid>.<ts>.tmp` from `lock.ts` `writeAtomic`, `x.tmp`), JetBrains `x___jb_tmp___` /
 * `x___jb_old___`, Chromium `x.crswap`, vim's `4913` write probe. The rename's target event follows.
 */
const EDITOR_TEMP = /(^|\/)(\.[^/]*|#[^/]*|[^/]*~|4913)$|\.tmp(\.\d+\.[0-9a-z]+)?$|___jb_(tmp|old)___$|\.crswap$/i;
const TEMPLATE_SKIP = /^[^/]+\/(src\/routes\/|src\/components\/|README\.md$|node_modules\/|dist\/|\.rivet\/)/;

/** Whether a changed path (absolute) is not a source of the site at `root`. */
export function ignored(file: string, root: string, repo: string): boolean {
  const app = posix(relative(root, file));
  if (!app.startsWith("..")) {
    if (APP_GENERATED.test(app) || EDITOR_TEMP.test(app)) return true;
    return !/^(content|examples|src)\//.test(app) && !APP_CONFIG.has(app) && app !== "api.config.ts";
  }
  const rel = posix(relative(repo, file));
  if (EDITOR_TEMP.test(rel)) return true;
  if (rel.startsWith("templates/")) return /\/(node_modules|dist|\.rivet)\//.test(rel);
  if (rel.startsWith("libs/")) return LIB_IGNORED.test(rel.slice("libs/".length));
  return true;
}

/** What `files` (absolute paths) require. `exists(id)`: whether examples/<id>/example.ts exists. */
export function classify(files: readonly string[], context: { root: string; repo: string; graphs: Graphs; exists?: (id: string) => boolean }): Plan {
  const { root, repo, graphs } = context;
  const exists = context.exists ?? ((id: string) => existsSync(resolve(root, "examples", id, "example.ts")));
  const plan: Plan = { changed: [], content: false, api: false, examples: [], site: "none" };
  const examples = new Set<string>();
  for (const file of new Set(files)) {
    if (ignored(file, root, repo)) continue;
    plan.changed.push(posix(relative(repo, file)));
    const app = posix(relative(root, file));
    if (!app.startsWith("..")) {
      if (app.startsWith("content/")) {
        plan.content = true;
        plan.site = atLeast(plan.site, "pages");
      } else if (app.startsWith("examples/")) {
        const id = app.split("/")[1]!;
        if (app.split("/").length < 3) continue;
        // Shared example files (`examples/_assets/**`) and added / removed examples change shared generated
        // modules (frame index, stylesheets): every page. An edit inside one example: its pages.
        if (id.startsWith("_") || !exists(id)) plan.site = "full";
        else examples.add(id);
        plan.content = true;
        plan.site = atLeast(plan.site, "pages");
      } else if (app === "api.config.ts") {
        plan.api = true;
        plan.site = "full";
      } else plan.site = "full"; // src/**, site/vite config, api.json written by another process
      continue;
    }
    const rel = posix(relative(repo, file));
    if (rel.startsWith("templates/")) {
      // Starters (`::starter`) and the stylesheet base of examples without their own.
      plan.content = true;
      plan.site = "full";
      continue;
    }
    // libs/**: the site when its graph has the file (or it is tooling, or no graph was recorded).
    if (TOOLING.test(rel) || !graphs.site || graphs.site.has(rel)) plan.site = "full";
  }
  if (plan.site === "full") plan.content = true;
  plan.examples = [...examples].sort();
  return plan;
}

/** Whether a plan has any work. */
export const hasWork = (plan: Plan) => plan.site !== "none" || plan.api;

/** Merge two plans (a batch that arrived while another rebuild ran failed and is retried with the next). */
export function mergePlans(a: Plan, b: Plan): Plan {
  return {
    changed: [...new Set([...a.changed, ...b.changed])],
    content: a.content || b.content,
    api: a.api || b.api,
    examples: [...new Set([...a.examples, ...b.examples])].sort(),
    site: atLeast(a.site, b.site),
  };
}

/** Directories `serve` watches for the site at `root`. */
export function watchedDirs(root: string, repo: string): string[] {
  return [resolve(root, "content"), resolve(root, "examples"), resolve(root, "src"), resolve(repo, "templates"), resolve(repo, "libs")].filter((dir) =>
    existsSync(dir),
  );
}

/**
 * Watch the site's sources; `onChange` gets the absolute paths of each debounced burst (`debounce` ms
 * after the last event). Config files in the app root are watched non-recursively.
 */
export function watchSources(root: string, repo: string, onChange: (files: string[]) => void, options: { debounce?: number } = {}): { close(): void } {
  const pending = new Set<string>();
  let timer: NodeJS.Timeout | undefined;
  const add = (dir: string, name: string | null) => {
    if (!name) return;
    const file = resolve(dir, name);
    if (ignored(file, root, repo)) return;
    pending.add(file);
    clearTimeout(timer);
    timer = setTimeout(() => {
      const files = [...pending];
      pending.clear();
      onChange(files);
    }, options.debounce ?? 300);
  };
  const watchers: FSWatcher[] = watchedDirs(root, repo).map((dir) => watch(dir, { recursive: true }, (_, name) => add(dir, name)));
  watchers.push(watch(root, (_, name) => add(root, name)));
  for (const watcher of watchers) watcher.on("error", () => {});
  return {
    close() {
      clearTimeout(timer);
      for (const watcher of watchers) watcher.close();
    },
  };
}

/** Source files (absolute) modified after `since` (ms epoch): what changed while `serve` was not running. */
export async function changedSince(root: string, repo: string, since: number): Promise<string[]> {
  const found: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    await Promise.all(
      entries.map(async (entry) => {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) {
          // Prune ignored trees early (node_modules, dist, generated routes, rust target, …).
          if (ignored(join(path, "x.ts"), root, repo) && ignored(join(path, "x.md"), root, repo) && !path.startsWith(resolve(root, "examples"))) return;
          if (/[\\/](node_modules|dist|target|\.git)$/.test(path)) return;
          return walk(path);
        }
        if (!entry.isFile() || ignored(path, root, repo)) return;
        const info = await stat(path).catch(() => null);
        if (info && info.mtimeMs > since) found.push(path);
      }),
    );
  };
  for (const dir of watchedDirs(root, repo)) await walk(dir);
  for (const name of [...APP_CONFIG, "api.config.ts", "src/generated/api.json"]) {
    const info = await stat(resolve(root, name)).catch(() => null);
    if (info && info.mtimeMs > since) found.push(resolve(root, name));
  }
  return found.sort();
}
