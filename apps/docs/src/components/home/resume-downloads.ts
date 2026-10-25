import { recAt, urlOf } from "@rivetjs/runtime/resume-format";
import type { BoundaryTail } from "@rivetjs/runtime/resume-format";

// The boundaries holding a node, innermost first: an element root's `data-b`, else the `<!--b<id>-->` … `<!--/b-->`
// comment pair around it (the derived loader's walk).
const boundaryIds = (node: Node | null): string[] => {
  const ids: string[] = [];
  for (let at = node; at && at.nodeType !== 9; at = at.parentNode) {
    const own = (at as Element).getAttribute?.("data-b");
    if (own) ids.push(own);
    for (let prev = at.previousSibling, depth = 0; prev; prev = prev.previousSibling)
      if (prev.nodeType === 8) {
        const data = (prev as Comment).data;
        if (data === "/b") depth++;
        else if (/^b\d+$/.test(data)) depth ? depth-- : ids.push(data.slice(1));
      }
  }
  return ids;
};

/** The readout of the demo's first click: what was fetched for the click, and what was already prefetched before it. */
export interface Downloads {
  /** File names fetched after the click (` · `-separated), or "not measured". */
  files: string;
  /** "Fetched for this click: N files, X KB over the network (Y KB uncompressed), in T ms", or why it was not measured. */
  cost: string;
  /** File names whose request started before the click (hover / focus intent prefetch, an earlier interaction). */
  earlyFiles: string;
  /** "Already prefetched before the click: M files, …", or "" when nothing was. */
  earlyCost: string;
}

const unmeasured = (why: string): Downloads => ({ files: "not measured", cost: why, earlyFiles: "", earlyCost: "" });

/**
 * Actual downloads for this button: the scripts the click fetched (the runtime, its boundary's chunk and their imports),
 * never the whole page. Its roots requested before the click's `timeStamp` are reported apart from the ones the click made.
 */
export async function loadedFor(event: Event): Promise<Downloads> {
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const ids = new Set(boundaryIds((event.target as Element).closest("button")));
  if (!ids.size) return unmeasured("the example's boundary was not found");
  const tails = [...document.querySelectorAll<HTMLScriptElement>('script[type="rivet/boundaries"]')];
  const runtime = tails.find((node) => node.dataset.rt)?.dataset.rt;
  if (!runtime) return unmeasured("chunk information is available in a production build");
  // The click's roots: the runtime + the chunks of the button's boundaries (tail v2: record → names table `n` → URL `u`).
  const roots = new Set([runtime]);
  for (const node of tails) {
    const tail = JSON.parse(node.textContent!) as BoundaryTail;
    for (const id of ids) {
      const record = recAt(tail, +id),
        url = record && urlOf(tail, record[3]);
      if (url) roots.add(url);
    }
  }
  const path = (url: string) => {
    const resolved = new URL(url, location.href);
    return resolved.origin + resolved.pathname;
  };
  const needed = new Set([...roots].map(path));
  // Their static imports: every script the page fetched from the click on (nothing else loads then), plus the roots when
  // an intent (hover / focus) prefetched them before it.
  for (const entry of resources) if (entry.startTime >= event.timeStamp && /\.m?js$/.test(path(entry.name))) needed.add(path(entry.name));
  // One entry per file: the earliest request (a prefetch, then the import served from it).
  const first = new Map<string, PerformanceResourceTiming>();
  for (const entry of resources) {
    const file = path(entry.name);
    const seen = first.get(file);
    if (needed.has(file) && (!seen || entry.startTime < seen.startTime)) first.set(file, entry);
  }
  if (!first.size) return unmeasured("no matching resource timing entries were recorded");
  const now = [...first.values()].filter((entry) => entry.startTime >= event.timeStamp);
  const early = [...first.values()].filter((entry) => entry.startTime < event.timeStamp);
  const end = Math.max(0, ...now.map((entry) => entry.responseEnd - event.timeStamp));
  return {
    files: names(now),
    cost: `Fetched for this click: ${now.length ? `${amount(now)}, in ${Math.round(end)} ms` : "none"}`,
    earlyFiles: names(early),
    earlyCost: early.length ? `Already prefetched before the click: ${amount(early)}` : "",
  };
}

const names = (entries: PerformanceResourceTiming[]) =>
  entries.map((entry) => entry.name.slice(entry.name.lastIndexOf("/") + 1).replace(/\?.*$/, "")).join(" · ");

/** "N files, X KB over the network (Y KB uncompressed)", or "N files, Y KB from cache". */
function amount(entries: PerformanceResourceTiming[]): string {
  let wire = 0;
  let decoded = 0;
  for (const entry of entries) {
    wire += entry.transferSize;
    decoded += entry.decodedBodySize;
  }
  const size = wire ? `${kb(wire)} over the network (${kb(decoded)} uncompressed)` : `${kb(decoded)} from cache`;
  return `${entries.length} ${entries.length === 1 ? "file" : "files"}, ${size}`;
}

const kb = (bytes: number) => (bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1)} KB`);
