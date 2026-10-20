import type { HandlerEntry, ResumeState } from "@rivetjs/runtime/resume-format";

// A raw state's handlers of an element: a repeated map (`RepeatedHandlers`, `[back, …relocation]`) copies the chunk lists
// of element `id - back` verbatim (only its capture refs differ, unused here).
const handlersOf = (e: Record<string, unknown>, id: string): Record<string, HandlerEntry> | undefined => {
  let value = e[id];
  while (Array.isArray(value)) value = e[(id = String(+id - (value[0] as number)))];
  return value as Record<string, HandlerEntry> | undefined;
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
 * Intersect actual downloads with this button's compiled handler/runtime dependency graph, never the whole page. Requests
 * that started before the click's `timeStamp` are reported apart from the ones the click itself made.
 */
export async function loadedFor(event: Event): Promise<Downloads> {
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const id = (event.target as Element).closest("button")?.getAttribute("data-r");
  if (!id) return unmeasured("the example's handler was not found");
  const script = [...document.querySelectorAll<HTMLScriptElement>('script[type="rivet/state"]')].find((node) => {
    const state = JSON.parse(node.textContent!) as ResumeState;
    return handlersOf(state.e, id)?.click;
  });
  if (!script?.hasAttribute("data-deps")) return unmeasured("dependency information is available in a production build");
  const state = JSON.parse(script.textContent!) as ResumeState;
  const handler = handlersOf(state.e, id)!.click!;
  const roots = new Set([state.rt!, ...handler[2].concat(handler[3] ?? []).map((index) => state.c[index]!)]);
  const path = (url: string) => {
    const resolved = new URL(url, location.href);
    return resolved.origin + resolved.pathname;
  };
  const needed = new Set([...roots].map(path));
  if (script.dataset.ld) needed.add(path(script.dataset.ld));
  try {
    await Promise.all(
      [...roots].map(async (root) => {
        const url = new URL(root.replace(/\.js$/, ".deps.js"), location.href).href;
        const deps = (await import(/* @vite-ignore */ url)).default as string[];
        needed.add(path(url));
        for (const dependency of deps) needed.add(path(dependency));
      }),
    );
  } catch {
    return unmeasured("the example's dependency information could not be loaded");
  }
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
