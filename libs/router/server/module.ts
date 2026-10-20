// Route server exports: values tagged by the `@rivetjs/router` wrappers (`load(…)`, `guard(…)`,
// `actions(…)`, `entries(…)`, `headers(…)`, `onRequest(…)`, `onGet(…)`…; any export name) plus the plain
// data exports `prerender` / `csrf` normalize to one `ServerModule`. Same rule for page / layout modules,
// sibling `*.server.ts` and plain `.ts` endpoints. Spec: docs/design/specs/2026-10-20-server-exports-design.md.
import type { ServerModule } from "./handler.ts";
import { SERVER_EXPORT } from "../shared/server-exports.ts";

/** Former magic export names → the wrapper that replaces them (an untagged export with one is an error). */
const MAGIC: Readonly<Record<string, string>> = {
  serverLoad: "load",
  serverGuard: "guard",
  serverActions: "actions",
  serverEntries: "entries",
  serverHeaders: "headers",
  onRequest: "onRequest",
  onGet: "onGet",
  onPost: "onPost",
  onPut: "onPut",
  onPatch: "onPatch",
  onDelete: "onDelete",
  onOptions: "onOptions",
};
/** Former sibling `*.server.ts` names (raw-loaded server modules only). */
const LEGACY: Readonly<Record<string, string>> = {
  load: "load",
  guard: "guard",
  actions: "actions",
  entries: "entries",
  headers: "headers",
  GET: "onGet",
  POST: "onPost",
  PUT: "onPut",
  PATCH: "onPatch",
  DELETE: "onDelete",
};

const cache = new WeakMap<object, ServerModule>();

const kindOf = (value: unknown): string | undefined =>
  typeof value === "function" || (typeof value === "object" && value !== null) ? (value as { [SERVER_EXPORT]?: string })[SERVER_EXPORT] : undefined;

/**
 * Normalize one module's exports by tag. `server`: a raw-loaded server module (sibling `*.server.ts`,
 * plain `.ts` endpoint) — its former sibling names (`load`, `GET`…) are checked too. Errors (thrown at the
 * first request that loads the module): two exports of one kind; an untagged export with a former magic name.
 */
export function serverExports(module: Record<string, unknown> | undefined, file = "route module", server = false): ServerModule {
  if (!module) return {};
  const cached = cache.get(module);
  if (cached) return cached;
  const out: Record<string, unknown> = {};
  const names: Record<string, string> = {};
  for (const name of Object.keys(module)) {
    const value = module[name];
    const kind = kindOf(value);
    if (kind === undefined) {
      const wrapper = MAGIC[name] ?? (server ? LEGACY[name] : undefined);
      if (wrapper !== undefined && value !== undefined)
        throw new Error(
          `${file}: \`${name}\` is not a server export: wrap it — \`export const x = ${wrapper}(…)\` (\`${wrapper}\` is exported by @rivetjs/router)`,
        );
      continue;
    }
    if (out[kind] !== undefined && out[kind] !== value) throw new Error(`${file}: \`${names[kind]}\` and \`${name}\` are both \`${kind}(…)\`; keep one`);
    out[kind] = value;
    names[kind] = name;
  }
  if (module.prerender !== undefined) out.prerender = module.prerender;
  if (module.csrf !== undefined) out.csrf = module.csrf;
  const result = out as ServerModule;
  cache.set(module, result);
  return result;
}

/**
 * Merge a page/layout module's in-file server exports with its sibling `*.server.ts` (generated
 * loaders call this for routes that have both). One kind defined in both is an error.
 */
const merges = new WeakMap<object, WeakMap<object, ServerModule>>();
/** Merge a route module's in-file server exports with its sibling `*.server.ts`. */
export function mergeServer(inline: Record<string, unknown>, sibling: Record<string, unknown>, files: readonly string[] = ["page", "sibling"]): ServerModule {
  // Per (inline, sibling) module pair: a hot edit brings new module objects, hence a new merge.
  const cached = merges.get(inline)?.get(sibling);
  if (cached) return cached;
  const a = serverExports(inline, files[0]);
  const b = serverExports(sibling, files[1], true);
  for (const key of Object.keys(b)) if (key in a) throw new Error(`${files[0]} and ${files[1]} both define the route's \`${key}\`; keep one`);
  const merged: ServerModule = { ...b, ...a };
  let bySibling = merges.get(inline);
  if (!bySibling) merges.set(inline, (bySibling = new WeakMap()));
  bySibling.set(sibling, merged);
  return merged;
}

/**
 * Load a route table entry's server module. Generated loaders (`build/codegen.ts`) return it normalized
 * (`serverExports` / `mergeServer`): `AppRoute.server` / `layouts` return `ServerModule`s.
 */
export function loadServer(load: (() => Promise<ServerModule>) | undefined): Promise<ServerModule> | undefined {
  return load?.();
}
