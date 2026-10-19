// Inline stream add-on, shipped only on pages with streamed Async boundaries (after the loader).
// Serialized with String(stream), so it must be self-contained: browser globals and the loader's
// `document.$r` hooks only.
//
// `$rA(marker)` runs once per streamed segment: swap the template's content into the boundary's
// markers (unless the browser already re-created its region), merge the state patch (queued until
// the loader parses), register it with a started runtime, listen for new event types, schedule its
// preloads, and boot the runtime when the patch needs it. Boundaries still pending when the document
// finishes parsing (cut stream) continue in the browser.
import type { AsyncEntry, LoaderDocument, ResumeState, StatePatch } from "./resume-format.ts";

/** Patch fields merged by key (objects) or appended (lists). */
type Merged = Record<string, Record<string, unknown> | unknown[] | undefined>;

export function stream(): void {
  const d = document as LoaderDocument,
    r = d.$r!,
    queue: StatePatch[] = [],
    pending: Record<string, number[] | AsyncEntry> = {};
  let s: ResumeState;
  // The loader's own state script (never a document query: an injected earlier copy would win).
  for (const triple of (r.x.dataset.stream || "").split(" ")) if (triple) pending[triple.split(",")[0]!] = triple.split(",").map(Number);
  // Merge a patch into parsed state; the runtime (when started) registers the new entries.
  const merge = (x: StatePatch): void => {
    if (x.t) {
      if (x.t0 != s.t.length) return r.f(Error("resume patch out of order"));
      s.t.push(...x.t);
      s.c.push(...x.c!);
      for (const k of ["e", "m", "l"]) Object.assign(((s as unknown as Merged)[k] ??= {}), (x as unknown as Merged)[k]);
      d.$rx?.(s, x.b!, x);
      for (const k of ["s", "b", "fx", "ce", "x", "w"]) (((s as unknown as Merged)[k] ??= []) as unknown[]).push(...(((x as unknown as Merged)[k] as unknown[]) || []));
      if (x.g) s.g = x.g;
    }
    for (const entry of x.a || []) {
      const i = (s.a ??= []).findIndex((e) => e[0] == entry[0]);
      i < 0 ? s.a.push(entry) : (s.a[i] = entry);
    }
    r.r()?.patch(x);
  };
  // Loader parse: apply patches that arrived first.
  d.$rp = (state: ResumeState) => {
    s = state;
    queue.splice(0).map(merge);
  };
  const apply = (x: StatePatch): void => {
    for (const entry of x.a || []) entry[3] ? delete pending[entry[0]] : (pending[entry[0]] = entry);
    s ? merge(x) : queue.push(x);
    (x.ev || []).map(r.l);
    if (x.p) r.s(x.p);
    if (x.boot || (x.a || []).some((e) => e[3] == 2)) r.b();
  };
  (window as Window & { $rA?: (id: number) => void }).$rA = (id: number) => {
    // `<template data-a>` (when the segment has content), `<script data-patch>`, then this call's own
    // script: bound by position, never by a document query an injected earlier copy would win.
    const patch = d.currentScript!.previousElementSibling!,
      prev = patch.previousElementSibling as HTMLTemplateElement | null,
      tpl = prev?.getAttribute("data-a") == (id as unknown as string) ? prev : null,
      x: StatePatch = JSON.parse(patch.textContent!),
      self = x.a!.find((e) => e[0] == id)!;
    patch.remove();
    if (tpl) {
      if (!r.r()?.dead(self[2])) {
        // Boundary markers: `r<id>[` … its matching `]` (sibling markers nest).
        const walker = d.createTreeWalker(d.body, 128);
        let start: Comment | null, node: ChildNode | null, depth = 0;
        while ((start = walker.nextNode() as Comment | null) && start.data != "r" + id + "[");
        if (start) {
          for (node = start.nextSibling; node; ) {
            const next = node.nextSibling;
            if (node.nodeType == 8) {
              if (/^r\d*\[?$/.test((node as Comment).data)) depth++;
              else if ((node as Comment).data == "/" || (node as Comment).data == "]") if (!depth--) break;
            }
            node.remove();
            node = next;
          }
          node?.before(tpl.content);
        }
      }
      tpl.remove();
    }
    apply(x);
  };
  // Document parsed with boundaries still pending (stream cut): continue them in the browser.
  d.addEventListener("DOMContentLoaded", () => {
    for (const id in pending) {
      const [a, f, m] = pending[id] as number[] as AsyncEntry;
      apply({ a: [[a, f, m, 2]] });
    }
  });
}
