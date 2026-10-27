// ZERO STATESPACE (2026-10-26): the per-call-site proof of native automata. A component family whose whole state space a
// native element realises — a switch is a checkbox input (`role="switch"`), an accordion is `<details name>` — renders
// static native markup at a call site where nothing else can observe or drive that state: the browser owns it (label
// click, Space / Enter, `name` exclusivity), the stylesheet derives every visual state from `:checked` / `[open]` /
// `:hover` / `:focus-visible`, and the server keeps no record, so the page ships no JavaScript for it, before or after an
// interaction. `boundaryFacts()` (facts-fixpoint.ts) calls `nativeSites()` with the families the walked modules declare.
//
// Declaration: a line comment in the family's module, root first, each part with the props its native path renders
// (`data-*` / `aria-*` always allowed):
//
//   // @rivet-native SwitchRoot(children,class,size,defaultSelected) SwitchContent(children,class) …
//
// A call site of the root (in caller C) is proven when:
// - the root call and every call C's JSX encloses in it (`around` holds the root) pass declared props only: no spread
//   (`...`), no function (`fn`, a `()` render-prop child) and plain values only (`name*`: a signal read, an expression
//   over local state — a live prop the native markup would not follow);
// - every other component in it is a non-boundary that reads no context (an `Icon`): nothing below can read or drive
//   the family's state through its contexts, and no boundary below needs an adopt run of the family's parts;
// - no part other than the root is called inside a call of itself with no root in between (TABLE-NATIVE: a column
//   group, a tree row: the native markup cannot nest them);
// - no part of the family is called where no root of it encloses the call in the same JSX (a wrapper component, JSX built
//   outside the root and inserted as a value), and no part is used as a value (`componentValues`): then a native root's
//   subtree holds only parts the proof saw. One such use anywhere makes every site of that family unproven.
// The root re-checks its own props at run time (a getter = a live prop; a provider above that merges props) before it
// takes the path: same answer on both targets (props and contexts are the same on the server and in an adopt run).
import type { ComponentBoundaryFacts as ComponentFacts, ModuleFacts } from "./index.ts";

/** One `@rivet-native` declaration: the root component and every part's allowed props (the root included). */
export interface NativeFamily {
  root: string;
  parts: Map<string, ReadonlySet<string>>;
}

const PRAGMA = /^[ \t]*\/\/[ \t]*@rivet-native[ \t]+(.+)$/gm;
const PART = /([A-Za-z_$][\w$]*)\(([^)]*)\)/g;

/** The `@rivet-native` declarations of a module source (none: empty). */
export function nativeFamilies(source: string): NativeFamily[] {
  if (!source.includes("@rivet-native")) return [];
  const out: NativeFamily[] = [];
  for (const line of source.matchAll(PRAGMA)) {
    const parts = new Map<string, ReadonlySet<string>>();
    let root: string | null = null;
    for (const [, name, list] of line[1]!.matchAll(PART)) {
      root ??= name!;
      parts.set(
        name!,
        new Set(
          list!
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        ),
      );
    }
    if (root) out.push({ root, parts });
  }
  return out;
}

/** A resolved call site (facts-fixpoint.ts `sites` entries): caller id, its index in the caller's `calls`, enclosing ids. */
export interface NativeSite {
  caller: string;
  index: number;
  fn: boolean;
  around: (string | null)[];
}

/**
 * A module's source styles a component state the native markup does not carry as an attribute: a selector or Tailwind
 * variant over `data-expanded` / `data-selected` / `aria-expanded` / … (`[aria-expanded='true']`, `group-data-[expanded]:`,
 * `data-selected:`). Native markup exposes state as `[open]` / `:checked` only, so such a caller keeps today's path.
 */
const STATE = "(?:data|aria)-\\[?(?:expanded|selected|checked|hovered|pressed|focus-visible|focused|open)";
const STATE_STYLE = new RegExp(`[\\[:-]${STATE}|(?:^|[\\s"'\`])${STATE}(?:=[^{"]|[:\\]])`, "m");
export const stylesState = (source: string): boolean => STATE_STYLE.test(source);

/** The build's native inputs (vite.ts `derivedWalk`). */
export interface NativeOptions {
  /** file → declared families. */
  families: Map<string, NativeFamily[]>;
  /** Files whose source styles a component state (`stylesState`): their call sites stay unproven. */
  stateStyled: ReadonlySet<string>;
}

export interface NativeInput extends NativeOptions {
  facts: Map<string, ModuleFacts>;
  /** Component id (`file?name`) → facts. */
  info: Map<string, ComponentFacts>;
  /** Callee id → its resolved call sites. */
  sites: Map<string, NativeSite[]>;
  /** Component ids used as values (prop, table, direct call). */
  escaped: ReadonlySet<string>;
  /** Component id → boundary (facts-fixpoint.ts `interactive`). */
  interactive: (id: string) => boolean;
  /** Component id → its data can change in the browser (facts-fixpoint.ts `live`). */
  live: (id: string) => boolean;
  /** Component id → the component ids it renders (null: an unresolved tag). */
  renders: Map<string, (string | null)[]>;
}

/** Proven native call sites by caller file: `"<Caller>:<call index>"` (`resume.native`). */
export function nativeSites(input: NativeInput): Map<string, string[]> {
  const { info, sites, escaped, interactive, live, renders, families, stateStyled } = input;
  const out = new Map<string, string[]>();
  const id = (file: string, name: string) => file + "?" + name;
  const nameOf = (cid: string) => cid.slice(cid.lastIndexOf("?") + 1);
  const fileOf = (cid: string) => cid.slice(0, cid.lastIndexOf("?"));
  // Per caller: its calls by index → resolved callee (inverted `sites`).
  const callee = new Map<string, Map<number, string>>();
  for (const [to, list] of sites)
    for (const s of list) {
      let m = callee.get(s.caller);
      if (!m) callee.set(s.caller, (m = new Map()));
      m.set(s.index, to);
    }
  const siteOf = (caller: string, index: number, to: string) => sites.get(to)?.find((s) => s.caller === caller && s.index === index);
  const trace = process.env.RIVET_NATIVE_TRACE ? (...a: unknown[]) => console.error("[native]", ...a) : null;
  // A non-part component inside a native root: this instance is no boundary and reads no context — no change source of
  // its own (`source` / `listens`), static inputs at this call (data, or values a caller that is not live computes: a
  // component that is a boundary only through live props elsewhere, kit `Icon`, is static here) and no boundary below.
  const staticInstance = (to: string, caller: string, inputs: boolean): boolean => {
    const c = info.get(to);
    return !!c && !c.source && !c.listens && !c.context && (inputs || !live(caller)) && !(renders.get(to) ?? []).some((t) => t === null || interactive(t));
  };
  // A non-root part inside the same part with no root of the family in between (`around` is innermost first): a nested
  // column (column groups) or a nested row (tree rows) has no native rendering (`<th>` in a `<th>`, `<tr>` in a `<tr>`).
  const selfNested = (around: (string | null)[], part: string, rootId: string): boolean => {
    for (const tag of around) {
      if (tag === rootId) return false;
      if (tag === part) return true;
    }
    return false;
  };
  const allowed = (attrs: string[] | undefined, keys: ReadonlySet<string>): boolean =>
    attrs !== undefined && attrs.every((a) => (keys.has(a) || a.startsWith("data-") || a.startsWith("aria-")) && !a.endsWith("*"));
  for (const [file, list] of families)
    for (const family of list) {
      const rootId = id(file, family.root);
      if (!info.has(rootId)) continue;
      const parts = new Map<string, ReadonlySet<string>>();
      for (const [name, keys] of family.parts) if (info.has(id(file, name))) parts.set(id(file, name), keys);
      // Global: a part used as a value, or called where no root encloses it in the same JSX.
      // (Calls between the family's own parts — a root's shorthand rendering its parts — are the family's code.)
      let closed = true;
      for (const [part] of parts) {
        if (escaped.has(part)) ((closed = false), trace?.(rootId, "escaped", part));
        if (part === rootId) continue;
        for (const s of sites.get(part) ?? [])
          if (!s.around.includes(rootId) && !parts.has(s.caller)) ((closed = false), trace?.(rootId, "orphan", part, "in", s.caller));
      }
      if (!closed) continue;
      for (const site of sites.get(rootId) ?? []) {
        const calls = info.get(site.caller)?.calls;
        if (!calls) continue;
        if (stateStyled.has(fileOf(site.caller))) {
          trace?.(rootId, "state styles", site.caller);
          continue;
        }
        const own = calls[site.index];
        if (!own || site.fn || !allowed(own.attrs, parts.get(rootId)!)) {
          trace?.(rootId, "root call", site.caller, site.index, own?.attrs, site.fn);
          continue;
        }
        let ok = true;
        const resolved = callee.get(site.caller);
        calls.forEach((call, index) => {
          if (!ok || index === site.index) return;
          const to = resolved?.get(index);
          const s = to ? siteOf(site.caller, index, to) : undefined;
          // Enclosed by a root of this family (`around` resolves; an unresolved tag never names the root).
          if (!s ? !call.around.some((tag) => tag === own.tag) : !s.around.includes(rootId)) return;
          if (!to) {
            ok = false; // An unresolved component inside the root: unknown code.
            trace?.(rootId, "unresolved", site.caller, call.tag);
            return;
          }
          const keys = parts.get(to);
          if (keys) {
            if (s!.fn || !allowed(call.attrs, keys)) ((ok = false), trace?.(rootId, "part call", site.caller, call.tag, call.attrs, s!.fn));
            else if (to !== rootId && selfNested(s!.around, to, rootId)) ((ok = false), trace?.(rootId, "nested part", site.caller, call.tag));
          } else if (s!.fn || !staticInstance(to, site.caller, call.inputs)) ((ok = false), trace?.(rootId, "inner", site.caller, call.tag));
        });
        if (!ok) continue;
        trace?.(rootId, "proven", site.caller, site.index);
        const callerFile = fileOf(site.caller);
        let entries = out.get(callerFile);
        if (!entries) out.set(callerFile, (entries = []));
        entries.push(nameOf(site.caller) + ":" + site.index);
      }
    }
  return out;
}
