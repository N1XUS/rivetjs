// Route server exports: the in-file names (`serverLoad`, `serverGuard`, `serverActions`,
// `serverEntries`, `serverHeaders`, `prerender`, `csrf`, `onRequest`, `onGet`…) and the sibling `*.server.ts`
// names (`load`, `guard`, `actions`, `entries`, `headers`, `GET`…) normalize to one `ServerModule`.
import type { ServerModule } from "./handler.ts";

/** In-file name → `ServerModule` key. */
const RENAMED = {
  serverLoad: "load",
  serverGuard: "guard",
  serverActions: "actions",
  serverEntries: "entries",
  serverHeaders: "headers",
} as const;
const KEPT = ["prerender", "csrf", "onRequest", "onGet", "onPost", "onPut", "onPatch", "onDelete", "onOptions"] as const;
/** Sibling-only names (migration; `rivet migrate server-exports` renames them). */
const LEGACY = ["load", "guard", "actions", "entries", "headers", "GET", "POST", "PUT", "PATCH", "DELETE"] as const;

const cache = new WeakMap<object, ServerModule>();
const normalized = new WeakSet<object>();

/**
 * Normalize one module's exports. `legacy`: a sibling `*.server.ts` (old names accepted; a module
 * exporting both `load` and `serverLoad` is an error). In-file (page/layout) modules use the new names
 * only: their `load`/`guard`… are ordinary exports.
 */
export function serverExports(module: Record<string, unknown> | undefined, legacy: boolean, file = "route module"): ServerModule {
  if (!module) return {};
  const cached = cache.get(module);
  if (cached) return cached;
  const out: Record<string, unknown> = {};
  for (const [name, key] of Object.entries(RENAMED)) {
    if (module[name] === undefined) continue;
    if (legacy && module[key] !== undefined) throw new Error(`${file}: exports both \`${key}\` and \`${name}\`; keep \`${name}\``);
    out[key] = module[name];
  }
  for (const name of KEPT) if (module[name] !== undefined) out[name] = module[name];
  if (legacy) for (const name of LEGACY) if (module[name] !== undefined && out[name] === undefined) out[name] = module[name];
  const result = out as ServerModule;
  cache.set(module, result);
  normalized.add(result);
  return result;
}

/**
 * Merge a page/layout module's in-file server exports with its sibling `*.server.ts` (generated
 * loaders call this for routes that have both). One export defined in both is an error.
 */
const merges = new WeakMap<object, WeakMap<object, ServerModule>>();
/** Merge a route module's in-file server exports with its sibling `*.server.ts`. */
export function mergeServer(inline: Record<string, unknown>, sibling: Record<string, unknown>, files: readonly string[] = ["page", "sibling"]): ServerModule {
  // Per (inline, sibling) module pair: a hot edit brings new module objects, hence a new merge.
  const cached = merges.get(inline)?.get(sibling);
  if (cached) return cached;
  const a = serverExports(inline, false, files[0]);
  const b = serverExports(sibling, true, files[1]);
  for (const key of Object.keys(b)) if (key in a) throw new Error(`${files[0]} and ${files[1]} both define the route's \`${key}\`; keep one`);
  const merged: ServerModule = { ...b, ...a };
  normalized.add(merged);
  let bySibling = merges.get(inline);
  if (!bySibling) merges.set(inline, (bySibling = new WeakMap()));
  bySibling.set(sibling, merged);
  return merged;
}

/**
 * Load and normalize a route table entry's server module. Generated loaders return in-file and merged
 * modules normalized, and sibling `*.server.ts` modules raw (old names accepted).
 */
export async function loadServer(load: (() => Promise<unknown>) | undefined): Promise<ServerModule | undefined> {
  const module = (await load?.()) as Record<string, unknown> | undefined;
  if (!module) return undefined;
  return normalized.has(module) ? (module as ServerModule) : serverExports(module, true, "server module");
}
