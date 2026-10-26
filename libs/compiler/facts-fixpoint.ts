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
// state; a handler whose value is conditional — `cond ? f : undefined`, `props.onX` — counts per instance: `listens`,
// conditional, STATIC-ZERO T3), when it renders a boundary, or when live data flows into a component whose sites read its
// inputs (a caller passes a function, or passes non-data while its own data is live; or it reads a context whose
// provider's data is live) and some instance may render outside every boundary (ORPHAN-B 2026-10-26: an `enclosed` one —
// every call site's caller a boundary or enclosed — is `live` but no boundary: the boundary around it runs its code
// inline). Props are live when the caller passes a reactive value; literals are static: `<Meter value={40}>` is no
// boundary, ships no chunk and is never adopted. Tags resolve through re-exports (`export … from`, `export *`) and
// compound components (`Object.assign(Root, { Part })`, `<Meter.Output>`) of the walked modules, `.ts` re-export modules
// included. A component with no resolved call site (rendered by code the walk does not see) counts its inputs as live.
import type { ComponentBoundaryFacts as ComponentFacts, ModuleFacts } from "./index.ts";
import { callSites, type CallSites, type ContextOptions } from "./facts-callsite.ts";
import { nativeSites, type NativeOptions } from "./facts-native.ts";

/** The derived model's verdict for one component. */
export interface BoundaryVerdict {
  /** A boundary: a change source of its own, live data into its read sites, or a boundary below it. */
  interactive: boolean;
  /** Its data can change in the browser (own source, live inputs or a live provider's context): what its calls pass on. */
  live: boolean;
  /**
   * Its inputs are values: a props object parameter (or a flat object pattern, ZERO A5: `{ a, b: c = 1, ...rest }` records
   * the object rebuilt from its bindings; a nested pattern stays dependent), no context consumed, and every call site in the
   * program passes data only (the compiler's data-only verdict per call: literals and, ZERO C3, plain values over
   * read-only module data — `books.map((b) => <Card title={b.title} />)`, Rust `plain_value`); route roots (`roots`)
   * count as independent.
   * Only meaningful for interactive components (`false` otherwise).
   */
  independent: boolean;
  /**
   * A boundary without a change source of its own (`because` is not `source`; ZERO C3: route roots too): the compiled
   * `_rB` carries `COND` and the server keeps its record only for an instance that turned out live — it read a source that
   * can change from outside its subtree (a live prop, slot content, a live context value), or a dependent boundary below
   * it was kept (an independent one adopts standalone; `server-derived.ts` "Conditional boundaries"). A static instance
   * (`<Meter value={40}>`) ships no record and no chunk; a page root that only renders independent cards neither.
   */
  conditional: boolean;
  /**
   * ZERO A1: an adopt walk may reach its server output — it is a boundary, a component that is adopted renders it, it is
   * used as a value (`ModuleFacts.componentValues`: a prop, a table, a direct call) or it has no resolved call site (not a
   * route root). `false`: its server output needs no slot markers (`resume.static`).
   */
  adopted: boolean;
  /** Why it is not independent (first reason), for the interaction map / dev output. */
  dependentBecause?: "not-interactive" | "destructured-props" | "context" | "not-exported" | "call-site" | "no-call-site";
  /** Why it is a boundary (first reason, by priority): own source, a conditional handler (`listens`: kept per instance
   * that installs a function, STATIC-ZERO T3), live data in, live context, a boundary below. Live data in / live context
   * only for a component not every instance of which renders inside a boundary (ORPHAN-B: an enclosed one runs inline in
   * the unit of the boundary around it). */
  because?: "source" | "listener" | "live-props" | "live-context" | "renders";
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
  /** Component names of `file` no adopt walk reaches (for `resume.static`, ZERO A1). */
  static(file: string): string[];
  /** ZERO CALLSITE (`contexts` given): the per-call-site context proof (`facts-callsite.ts`); null without. */
  callSites: CallSites | null;
  /** ZERO STATESPACE: the call sites of `file` proven native automata (`facts-native.ts`, `resume.native`). */
  native(file: string): string[];
  /** PLACE (`place.ts`): resolved call sites by callee key (`file?Name`), in the order `callSites` trace results use. */
  callers: ReadonlyMap<string, readonly { caller: string; index: number }[]>;
  /** PLACE: route / derived roots (component keys). */
  roots: ReadonlySet<string>;
}

const key = (file: string, name: string) => file + "?" + name;

/**
 * Close the per-module component facts over the module graph. `facts`: file → `moduleFacts(…, { boundaries: true })`;
 * `resolved`: file → import specifier → resolved file (resumable files only, as `groupComponents` takes); `roots`: files
 * whose default export is a route component (always independent: loader data + params are values); `shells` (ZERO A1):
 * `file` (its default export) or `file#Name` components rendered only by a host that never adopts them (docs-kit
 * `FrameShell`): without a resolved call site they are adopted only through their own boundaries.
 */
export function boundaryFacts(
  facts: Map<string, ModuleFacts>,
  resolved: Map<string, Map<string, string>>,
  roots: ReadonlySet<string> = new Set(),
  shells: ReadonlySet<string> = new Set(),
  contexts?: ContextOptions,
  natives?: NativeOptions,
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
  type Site = { caller: string; index: number; data: boolean; inputs: boolean; fn: boolean; around: (string | null)[]; tags: string[] };
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
      c.calls.forEach((call, index) => {
        const to = resolveTag(file, call.tag);
        if (!to) return;
        let list = sites.get(to);
        if (!list) sites.set(to, (list = []));
        list.push({
          caller: id,
          index,
          data: call.data,
          inputs: call.inputs,
          fn: call.fn,
          around: call.around.map((tag) => resolveTag(file, tag)),
          tags: call.around,
        });
      });
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
  // Components used as values (`componentValues`): code the walk does not see may render them (and, ZERO A1, adopt them).
  const escaped = new Set<string>();
  for (const [file, f] of facts)
    for (const name of f.componentValues ?? []) {
      const bound = local(file, name, new Set());
      const hit = component(bound);
      if (hit) escaped.add(hit);
      const compound = bound && facts.get(bound.file)!.compounds?.get(bound.local);
      if (compound)
        for (const part of compound.parts.values()) {
          const p = component(local(bound!.file, part, new Set()));
          if (p) escaped.add(p);
        }
    }
  // ORPHAN-B (2026-10-26): live data alone (live props / a live context into its read sites) makes no boundary when every
  // instance renders inside a boundary (`enclosed`: every resolved call site's caller is a boundary or enclosed itself, and
  // no unseen code renders it). The change source is above it; the browser runs its code inline in the unit of the
  // boundary around it (its bindings read the live getters there), exactly as for a data-only caller, and change sources
  // its helpers make out of the facts' sight (a `createInView` trigger, `.ts` signals) belong to that boundary on both
  // sides. As a boundary of its own it was a conditional record dropped on every static instance (docs SideNav `Item`:
  // 123 of 136 `data-b` per page, no tail record) and one more dependent unit run per instance once an ancestor
  // materialised. Only plain data demotes: a call site that passes a function (a callback, a signal: `currentStep={step}`)
  // hands it behaviour that may write the caller's state while the browser adopts it (ui Stepper: a step unregistered by
  // the adopt run's probe clamps the two-way signal), so such a component is never enclosed.
  // Not enclosed (a frame page, a route rendered by the router's own code, a component passed as a value):
  // it stays a boundary as before (`kept`), else such a hidden source would have no boundary to report to.
  const kept = new Set<string>();
  for (let grew = true; grew;) {
    grew = false;
    for (let changed = true; changed;) {
      changed = false;
      for (const [id, c] of info) {
        const inputs = liveIn.get(id) || inputsLive(id);
        const context = liveContext.get(id) || (c.context && contextLive(id));
        const isLive = c.source || c.listens || inputs || context;
        const below = (renders.get(id) ?? []).some((t) => t !== null && interactive.get(t));
        const isInteractive = c.source || c.listens || ((inputs || context) && c.interactive && kept.has(id)) || below;
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
    // Enclosed (least fixpoint over the boundaries found so far; more boundaries only enclose more).
    const enclosed = new Set<string>();
    for (let changed = true; changed;) {
      changed = false;
      for (const [id, list] of sites)
        if (!enclosed.has(id) && !escaped.has(id) && !isRoot.has(id) && list.every((s) => !s.fn && (interactive.get(s.caller) || enclosed.has(s.caller))))
          (enclosed.add(id), (changed = true));
    }
    // Not enclosed: kept, outermost first — one whose caller is itself an open case waits for it (that caller kept may
    // enclose it); a cycle of open cases keeps them all.
    const open = new Set<string>();
    for (const [id, c] of info) if (!kept.has(id) && c.interactive && (liveIn.get(id) || liveContext.get(id)) && !enclosed.has(id)) open.add(id);
    let add = [...open].filter((id) => !(sites.get(id) ?? []).some((s) => s.caller !== id && open.has(s.caller)));
    if (!add.length) add = [...open];
    for (const id of add) (kept.add(id), (grew = true));
  }
  // ZERO A1 adopted (least fixpoint): a boundary, a component used as a value, one without a resolved call site (rendered
  // by code the walk does not see — a route root under the router's `Root`, a frame page under `FrameRoot` — unless it is
  // a `shells` entry), or one an adopted component renders. A compound used as a value counts with every part.
  const shell = (id: string): boolean => {
    const at = id.lastIndexOf("?");
    const file = id.slice(0, at),
      name = id.slice(at + 1);
    return shells.has(file + "#" + name) || (shells.has(file) && (facts.get(file)?.defaultName ?? "default") === name);
  };
  const adopted = new Set<string>();
  for (const id of info.keys()) if (interactive.get(id) || escaped.has(id) || (!sites.has(id) && !shell(id))) adopted.add(id);
  for (let changed = true; changed;) {
    changed = false;
    for (const [id, list] of sites) if (!adopted.has(id) && list.some((s) => adopted.has(s.caller))) (adopted.add(id), (changed = true));
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
        conditional: (isInteractive || isRoot.has(id)) && !c.source,
        adopted: adopted.has(id),
      };
      if (isInteractive)
        verdict.because = c.source
          ? "source"
          : c.listens
            ? "listener"
            : kept.has(id) && liveIn.get(id)
              ? "live-props"
              : kept.has(id) && liveContext.get(id)
                ? "live-context"
                : "renders";
      if (!isInteractive) verdict.dependentBecause = "not-interactive";
      else if (isRoot.has(id)) verdict.independent = true;
      else if (c.params === "destructured") verdict.dependentBecause = "destructured-props";
      else if (c.context) verdict.dependentBecause = "context";
      // A standalone adopt imports the component from its chunk (`dom-derived.ts` `exported`): a component the module
      // does not export adopts with its parent (else a `COND` parent left unkept strands it: no record, no chunk export).
      else {
        const list = sites.get(id);
        // A shell (ZERO A1: rendered only by a host that never adopts it) taking no props has no parent to adopt with and
        // nothing a call site could pass: standalone is its only adopt (RT-DIET: docs frame pages, then lite residuals).
        if (!list) shell(id) && c.params === "none" ? (verdict.independent = true) : (verdict.dependentBecause = "no-call-site");
        else if (name !== "default" && ![...f.exports.values()].includes(name) && list.every((s) => s.caller.startsWith(file + "?")))
          verdict.dependentBecause = "not-exported";
        else if (list.every((s) => s.data)) verdict.independent = true;
        else verdict.dependentBecause = "call-site";
      }
      byName.set(name, verdict);
    }
  }
  const names = (file: string, pick: (v: BoundaryVerdict) => boolean) => [...(verdicts.get(file) ?? [])].filter(([, v]) => pick(v)).map(([name]) => name);
  const native = natives?.families.size
    ? nativeSites({ ...natives, facts, info, sites, escaped, interactive: (id) => interactive.get(id) ?? false, live: (id) => live.get(id) ?? false, renders })
    : new Map<string, string[]>();
  const proof = contexts ? callSites({ facts, target, sites, verdicts, isRoot: (id) => isRoot.has(id), escaped, shell, options: contexts }) : null;
  return {
    callSites: proof,
    native: (file) => native.get(file) ?? [],
    callers: sites,
    roots: isRoot,
    verdicts,
    boundaries: (file) => names(file, (v) => v.interactive),
    independent: (file) => names(file, (v) => v.independent),
    conditional: (file) => names(file, (v) => v.conditional),
    static: (file) => names(file, (v) => !v.adopted),
  };
}
