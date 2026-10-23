// Derived model (M2 C1, plan docs/design/plans/2026-10-18-derived-client.md): the cross-module fixpoint over
// `moduleFacts(…, { boundaries: true })` — which components are boundaries (interactive) and which of those are
// independent (data inputs only). The compiler reports module-level facts; this closes them over the module graph like
// `groupComponents` resolves rendered tags, so a component rendering an interactive component from another module is
// interactive too, and a component is independent only when every call site in the program passes data.
//
// The Vite plugin (`vite.ts`, wired by the orchestrator) runs it once per build in `buildStart` over the resumable modules
// and passes each module's verdicts to its server compile as `resume: { module, boundaries, independent, conditional }`.
//
// Interactivity = change sources (M6-PARITY 6b, user ruling 2026-10-22): a component is a boundary when it has a change
// source of its own (`source`: handler, client effect / event, keyed state, resource, Async / clientOnly, a read of module
// state), when live data flows into a component whose sites read its inputs (`interactive` own sites: a caller passes a
// function, or passes non-data while its own data is live; or it reads a context whose provider's data is live), or when
// it renders a boundary. Props are live when the caller passes a reactive value; literals are static: `<Meter value={40}>`
// is no boundary, ships no chunk and is never adopted. Tags resolve through re-exports (`export … from`, `export *`) and
// compound components (`Object.assign(Root, { Part })`, `<Meter.Output>`) of the walked modules, `.ts` re-export modules
// included. A component with no resolved call site (rendered by code the walk does not see) counts its inputs as live.
import type { ComponentBoundaryFacts as ComponentFacts, ModuleFacts } from "./index.ts";

/** The derived model's verdict for one component. */
export interface BoundaryVerdict {
  /** A boundary: a change source of its own, live data into its read sites, or a boundary below it. */
  interactive: boolean;
  /** Its data can change in the browser (own source, live inputs or a live provider's context): what its calls pass on. */
  live: boolean;
  /**
   * Its inputs are values: a props object parameter (no destructuring), no context consumed, and every call site in the
   * program passes data only (the compiler's data-only verdict per call); route roots (`roots`) count as independent.
   * Only meaningful for interactive components (`false` otherwise).
   */
  independent: boolean;
  /**
   * A boundary without a change source of its own (`because` is not `source`; never a route root): the compiled `_rB`
   * carries `COND` and the server keeps its record only for an instance that turned out live — it read a source that can
   * change from outside its subtree (a live prop, slot content, a live context value), or a boundary below it was kept
   * (`server-derived.ts` "Conditional boundaries"). A static instance (`<Meter value={40}>`) ships no record and no chunk.
   */
  conditional: boolean;
  /** Why it is not independent (first reason), for the interaction map / dev output. */
  dependentBecause?: "not-interactive" | "destructured-props" | "context" | "call-site" | "no-call-site";
  /** Why it is a boundary (first reason, by priority): own source, live data in, live context, a boundary below. */
  because?: "source" | "live-props" | "live-context" | "renders";
}

/** `boundaryFacts()` result: file → component name → verdict, plus lookups by rendered tag. */
export interface BoundaryFacts {
  verdicts: Map<string, Map<string, BoundaryVerdict>>;
  /** Component names of `file` that are boundaries (for `resume.boundaries`). */
  boundaries(file: string): string[];
  /** Component names of `file` that are independent boundaries (for `resume.independent`). */
  independent(file: string): string[];
  /** Component names of `file` that are conditional boundaries (for `resume.conditional`). */
  conditional(file: string): string[];
}

const key = (file: string, name: string) => file + "?" + name;

/**
 * Close the per-module component facts over the module graph. `facts`: file → `moduleFacts(…, { boundaries: true })`;
 * `resolved`: file → import specifier → resolved file (resumable files only, as `groupComponents` takes); `roots`: files
 * whose default export is a route component (always independent: loader data + params are values).
 */
export function boundaryFacts(
  facts: Map<string, ModuleFacts>,
  resolved: Map<string, Map<string, string>>,
  roots: ReadonlySet<string> = new Set(),
): BoundaryFacts {
  const target = (file: string, spec: string) => resolved.get(file)?.get(spec) ?? null;
  type Bound = { file: string; local: string };
  // A local binding of `file` → the component it names, or a compound (`Object.assign(Root, { … })`) to look parts up in.
  const local = (file: string, name: string, seen: Set<string>): Bound | null => {
    const own = facts.get(file);
    if (!own || seen.has(file + "\0" + name)) return null;
    seen.add(file + "\0" + name);
    if (own.boundaries.has(name) || own.compounds?.has(name)) return { file, local: name };
    const imported = own.imports.get(name);
    const to = imported && target(file, imported.from);
    return imported && to ? exported(to, imported.imported, seen) : null;
  };
  // An export of `file` (direct, re-exported, `export *`, default) → its binding.
  const exported = (file: string, name: string, seen: Set<string>): Bound | null => {
    const own = facts.get(file);
    if (!own) return null;
    const direct = own.exports?.get(name);
    if (direct !== undefined) return local(file, direct, seen);
    const re = own.reexports?.get(name);
    if (re) {
      const to = target(file, re.from);
      return to && re.imported !== "*" ? exported(to, re.imported, seen) : null;
    }
    // An anonymous default export (`export default function () {}`) reports its facts as "default" (no `defaultName`);
    // facts of an older wasm carry no export lists (a component name is its export name).
    if (name === "default") return local(file, own.defaultName ?? "default", seen);
    if (own.boundaries.has(name)) return { file, local: name };
    for (const from of own.stars ?? []) {
      const to = target(file, from);
      const hit = to ? exported(to, name, seen) : null;
      if (hit) return hit;
    }
    return null;
  };
  // A binding → the component key (a compound names its root).
  const component = (bound: Bound | null, seen = new Set<string>()): string | null => {
    if (!bound) return null;
    const own = facts.get(bound.file)!;
    if (own.boundaries.has(bound.local)) return key(bound.file, bound.local);
    const compound = own.compounds?.get(bound.local);
    return compound ? component(local(bound.file, compound.root, seen), seen) : null;
  };
  // A rendered tag → the (file, name) it names: a local component, an import of one (through re-exports), a compound
  // component or one of its parts (`Meter.Output`).
  const resolveTag = (file: string, tag: string): string | null => {
    const dot = tag.indexOf(".");
    if (dot < 0) return component(local(file, tag, new Set()));
    const head = local(file, tag.slice(0, dot), new Set());
    const compound = head && facts.get(head.file)!.compounds?.get(head.local);
    const part = compound?.parts.get(tag.slice(dot + 1));
    return part !== undefined ? component(local(head!.file, part, new Set())) : null;
  };
  // Per component: facts, resolved renders, and its call sites by callee.
  type Site = { caller: string; data: boolean; inputs: boolean; fn: boolean; around: (string | null)[] };
  const info = new Map<string, ComponentFacts>();
  const renders = new Map<string, (string | null)[]>();
  const sites = new Map<string, Site[]>();
  const isRoot = new Set<string>();
  for (const [file, f] of facts)
    for (const [name, c] of f.boundaries) {
      const id = key(file, name);
      info.set(id, c);
      if (roots.has(file) && (f.defaultName ?? "default") === name) isRoot.add(id);
      renders.set(
        id,
        [...c.renders].map((tag) => resolveTag(file, tag)),
      );
      for (const call of c.calls) {
        const to = resolveTag(file, call.tag);
        if (!to) continue;
        let list = sites.get(to);
        if (!list) sites.set(to, (list = []));
        list.push({ caller: id, data: call.data, inputs: call.inputs, fn: call.fn, around: call.around.map((tag) => resolveTag(file, tag)) });
      }
    }
  // Least fixpoint (monotone): live data, then boundaries.
  const live = new Map<string, boolean>();
  const liveIn = new Map<string, boolean>();
  const liveContext = new Map<string, boolean>();
  const interactive = new Map<string, boolean>();
  const inputsLive = (id: string): boolean => {
    if (isRoot.has(id)) return false;
    const list = sites.get(id);
    if (!list) return true;
    return list.some((s) => !s.inputs && (s.fn || live.get(s.caller) === true));
  };
  // A context it reads may come from any provider above a call site: one enclosing it in the caller's JSX, the caller,
  // or (up the call sites) the caller's own ancestors. Unknown ancestry (no resolved call site, not a root) counts as live.
  const contextLive = (id: string): boolean => {
    const seen = new Set<string>();
    const up = (at: string): boolean => {
      if (seen.has(at)) return false;
      seen.add(at);
      if (isRoot.has(at)) return false;
      const list = sites.get(at);
      if (!list) return true;
      for (const s of list) {
        for (const a of s.around) if (a !== null && info.get(a)?.provides && live.get(a)) return true;
        if (info.get(s.caller)?.provides && live.get(s.caller)) return true;
        if (up(s.caller)) return true;
      }
      return false;
    };
    return up(id);
  };
  for (let changed = true; changed;) {
    changed = false;
    for (const [id, c] of info) {
      const inputs = liveIn.get(id) || inputsLive(id);
      const context = liveContext.get(id) || (c.context && contextLive(id));
      const isLive = c.source || inputs || context;
      const below = (renders.get(id) ?? []).some((t) => t !== null && interactive.get(t));
      const isInteractive = c.source || ((inputs || context) && c.interactive) || below;
      if (
        inputs !== (liveIn.get(id) ?? false) ||
        context !== (liveContext.get(id) ?? false) ||
        isLive !== (live.get(id) ?? false) ||
        isInteractive !== (interactive.get(id) ?? false)
      ) {
        liveIn.set(id, inputs);
        liveContext.set(id, context);
        live.set(id, isLive);
        interactive.set(id, isInteractive);
        changed = true;
      }
    }
  }
  // Independent: every call site in the program (by resolved target) passes data; unresolved targets never count.
  const verdicts = new Map<string, Map<string, BoundaryVerdict>>();
  for (const [file, f] of facts) {
    const byName = new Map<string, BoundaryVerdict>();
    verdicts.set(file, byName);
    for (const [name, c] of f.boundaries) {
      const id = key(file, name);
      const isInteractive = interactive.get(id) ?? false;
      const verdict: BoundaryVerdict = {
        interactive: isInteractive,
        live: live.get(id) ?? false,
        independent: false,
        conditional: isInteractive && !c.source && !isRoot.has(id),
      };
      if (isInteractive)
        verdict.because = c.source
          ? "source"
          : c.interactive && liveIn.get(id)
            ? "live-props"
            : c.interactive && liveContext.get(id)
              ? "live-context"
              : "renders";
      if (!isInteractive) verdict.dependentBecause = "not-interactive";
      else if (isRoot.has(id)) verdict.independent = true;
      else if (c.params === "destructured") verdict.dependentBecause = "destructured-props";
      else if (c.context) verdict.dependentBecause = "context";
      else {
        const list = sites.get(id);
        if (!list) verdict.dependentBecause = "no-call-site";
        else if (list.every((s) => s.data)) verdict.independent = true;
        else verdict.dependentBecause = "call-site";
      }
      byName.set(name, verdict);
    }
  }
  const names = (file: string, pick: (v: BoundaryVerdict) => boolean) => [...(verdicts.get(file) ?? [])].filter(([, v]) => pick(v)).map(([name]) => name);
  return {
    verdicts,
    boundaries: (file) => names(file, (v) => v.interactive),
    independent: (file) => names(file, (v) => v.independent),
    conditional: (file) => names(file, (v) => v.conditional),
  };
}
