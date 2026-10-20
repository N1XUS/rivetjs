// Server-only modules (SERVER-REACH, spec docs/design/specs/2026-10-20-server-reach-design.md): what counts as one, and
// the browser stand-in served in their place where a build lets one through. Build-time only (Vite plugins); nothing
// here ships to a browser except the stand-in module text `serverOnlyStub` returns.

/** A server-only module: a module id / specifier (`"virtual:docs/api"`), or a RegExp tested against both. */
export type ServerOnlyPattern = string | RegExp;

/** The marker module: `import "@rivetjs/router/server-only"` makes the importing module server-only. */
export const SERVER_ONLY_MARKER = "@rivetjs/router/server-only";
/** `x.server.ts` / `x.server.tsx` / `x.server` (secrets, server code): server-only by name. */
export const SERVER_FILE = /\.server(?:\.[cm]?[jt]sx?)?$/;

/**
 * Whether `specifier` (as written) or `id` (resolved, without query) names a server-only module: the marker, a
 * `*.server.*` file, or one of `patterns` (a string equals the specifier or the id; a RegExp matches either).
 */
export function isServerOnly(patterns: readonly ServerOnlyPattern[], specifier: string, id?: string): boolean {
  if (specifier === SERVER_ONLY_MARKER || SERVER_FILE.test(specifier.split("?")[0]!)) return true;
  if (id !== undefined && SERVER_FILE.test(id.split("?")[0]!)) return true;
  return matchesServerOnly(patterns, specifier, id);
}
/** Whether `specifier` / `id` matches one of `patterns` (declared server-only modules only, no marker / `*.server.*` rule). */
export function matchesServerOnly(patterns: readonly ServerOnlyPattern[], specifier: string, id?: string): boolean {
  for (const pattern of patterns)
    if (typeof pattern === "string" ? pattern === specifier || pattern === id : pattern.test(specifier) || (id !== undefined && pattern.test(id))) return true;
  return false;
}

/** Server-only patterns other Vite plugins declare (`api.rivetServerOnly`: docs-kit's `virtual:docs/api`, `rivet({ serverOnly })`). */
export function declaredServerOnly(plugins: readonly unknown[]): ServerOnlyPattern[] {
  const out: ServerOnlyPattern[] = [];
  for (const plugin of plugins) {
    const list = (plugin as { api?: { rivetServerOnly?: unknown } } | null)?.api?.rivetServerOnly;
    if (Array.isArray(list)) for (const pattern of list) if (typeof pattern === "string" || pattern instanceof RegExp) out.push(pattern);
  }
  return out;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
/**
 * Browser stand-in of a server-only module (ES module source): every export (`default` plus `names`) is one Proxy that
 * throws `<id> is server-only; reached from <chain>` on any property access, call or construction — instead of a silent
 * empty value. `chain`: importers, outermost first (display paths).
 */
export function serverOnlyStub(id: string, chain: readonly string[], names: Iterable<string> = []): string {
  const message = `[rivet] ${id} is server-only; reached from ${chain.length ? chain.join(" → ") : "browser code"}. The browser gets this stand-in, never the module: read it on the server (a load(…) export) and pass the data as props.`;
  const lines = [
    `const $$fail = () => { throw new Error(${JSON.stringify(message)}); };`,
    "const $$stub = new Proxy(function () {}, { get: $$fail, set: $$fail, has: $$fail, apply: $$fail, construct: $$fail, ownKeys: $$fail, getOwnPropertyDescriptor: $$fail, defineProperty: $$fail, deleteProperty: $$fail });",
    "export default $$stub;",
  ];
  let n = 0;
  for (const name of new Set(names)) {
    if (name === "default" || name === "*" || name.startsWith("$$")) continue;
    if (IDENTIFIER.test(name)) lines.push(`export const ${name} = $$stub;`);
    else lines.push(`const $$${n} = $$stub;`, `export { $$${n++} as ${JSON.stringify(name)} };`);
  }
  return lines.join("\n") + "\n";
}
