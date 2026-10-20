// Derived model (M2 C1, plan docs/design/plans/2026-10-18-derived-client.md): the cross-module fixpoint over
// `moduleFacts(…, { boundaries: true })` — which components are boundaries (interactive) and which of those are
// independent (data inputs only). The compiler reports module-level facts; this closes them over the module graph like
// `groupComponents` resolves rendered tags, so a component rendering an interactive component from another module is
// interactive too, and a component is independent only when every call site in the program passes data.
//
// The Vite plugin (`vite.ts`, wired by the orchestrator) runs it once per build in `buildStart` over the resumable modules
// and passes each module's verdicts to its server compile as `resume: { model: "derived", boundaries, independent }`.
import type { ModuleFacts } from "./index.ts";

/** The derived model's verdict for one component. */
export interface BoundaryVerdict {
  /** A boundary: its subtree (through rendered components, across modules) holds a resume site. */
  interactive: boolean;
  /**
   * Its inputs are values: a props object parameter (no destructuring), no context consumed, and every call site in the
   * program passes data only (the compiler's data-only verdict per call); route roots (`roots`) count as independent.
   * Only meaningful for interactive components (`false` otherwise).
   */
  independent: boolean;
  /** Why it is not independent (first reason), for the interaction map / dev output. */
  dependentBecause?: "not-interactive" | "destructured-props" | "context" | "call-site" | "no-call-site";
}

/** `boundaryFacts()` result: file → component name → verdict, plus lookups by rendered tag. */
export interface BoundaryFacts {
  verdicts: Map<string, Map<string, BoundaryVerdict>>;
  /** Component names of `file` that are boundaries (for `resume.boundaries`). */
  boundaries(file: string): string[];
  /** Component names of `file` that are independent boundaries (for `resume.independent`). */
  independent(file: string): string[];
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
  // A rendered tag → the (file, name) it names: a local component, or an import of one (default or named).
  const resolveTag = (file: string, tag: string): string | null => {
    const own = facts.get(file);
    if (!own) return null;
    // `ns.Tag` member tags: only a namespace import of a facts module resolves (`import * as ns`); not tracked → unknown.
    const dot = tag.indexOf(".");
    if (dot >= 0) return null;
    if (own.boundaries.has(tag)) return key(file, tag);
    const imported = own.imports.get(tag);
    const to = imported && target(file, imported.from);
    if (!imported || !to) return null;
    const theirs = facts.get(to);
    if (!theirs) return null;
    // An anonymous default export (`export default function () {}`) reports its facts as "default" (no `defaultName`).
    const name = imported.imported === "default" ? (theirs.defaultName ?? "default") : imported.imported;
    return name && theirs.boundaries.has(name) ? key(to, name) : null;
  };
  // Interactive: own sites, closed over rendered components (monotone: iterate to a fixpoint).
  const interactive = new Map<string, boolean>();
  const renders = new Map<string, (string | null)[]>();
  for (const [file, f] of facts)
    for (const [name, c] of f.boundaries) {
      interactive.set(key(file, name), c.interactive);
      renders.set(
        key(file, name),
        [...c.renders].map((tag) => resolveTag(file, tag)),
      );
    }
  for (let changed = true; changed;) {
    changed = false;
    for (const [id, tags] of renders) {
      if (interactive.get(id)) continue;
      if (tags.some((t) => t !== null && interactive.get(t))) {
        interactive.set(id, true);
        changed = true;
      }
    }
  }
  // Independent: every call site in the program (by resolved target) passes data; unresolved targets never count.
  const callSites = new Map<string, boolean[]>();
  for (const [file, f] of facts)
    for (const [, c] of f.boundaries)
      for (const call of c.calls) {
        const to = resolveTag(file, call.tag);
        if (!to) continue;
        let list = callSites.get(to);
        if (!list) callSites.set(to, (list = []));
        list.push(call.data);
      }
  const verdicts = new Map<string, Map<string, BoundaryVerdict>>();
  for (const [file, f] of facts) {
    const byName = new Map<string, BoundaryVerdict>();
    verdicts.set(file, byName);
    for (const [name, c] of f.boundaries) {
      const id = key(file, name);
      const isInteractive = interactive.get(id) ?? false;
      const verdict: BoundaryVerdict = { interactive: isInteractive, independent: false };
      if (!isInteractive) verdict.dependentBecause = "not-interactive";
      else if (roots.has(file) && (f.defaultName ?? "default") === name) verdict.independent = true;
      else if (c.params === "destructured") verdict.dependentBecause = "destructured-props";
      else if (c.context) verdict.dependentBecause = "context";
      else {
        const sites = callSites.get(id);
        if (!sites) verdict.dependentBecause = "no-call-site";
        else if (sites.every(Boolean)) verdict.independent = true;
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
  };
}
