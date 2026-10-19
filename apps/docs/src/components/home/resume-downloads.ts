import type { HandlerEntry, ResumeState } from "@rivetjs/runtime/resume-format";

// A raw state's handlers of an element: a repeated map (`RepeatedHandlers`, `[back, …relocation]`) copies the chunk lists
// of element `id - back` verbatim (only its capture refs differ, unused here).
const handlersOf = (e: Record<string, unknown>, id: string): Record<string, HandlerEntry> | undefined => {
  let value = e[id];
  while (Array.isArray(value)) value = e[(id = String(+id - (value[0] as number)))];
  return value as Record<string, HandlerEntry> | undefined;
};

/** Intersect actual downloads with this button's compiled handler/runtime dependency graph, never the whole page. */
export async function loadedFor(event: Event): Promise<[string, string]> {
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const id = (event.target as Element).closest("button")?.getAttribute("data-r");
  if (!id) return ["not measured", "the example's handler was not found"];
  const script = [...document.querySelectorAll<HTMLScriptElement>('script[type="rivet/state"]')].find((node) => {
    const state = JSON.parse(node.textContent!) as ResumeState;
    return handlersOf(state.e, id)?.click;
  });
  if (!script?.hasAttribute("data-deps")) return ["not measured", "dependency information is available in a production build"];
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
    return ["not measured", "the example's dependency information could not be loaded"];
  }
  const entries = resources.filter((entry) => needed.has(path(entry.name)));
  if (!entries.length) return ["not measured", "no matching resource timing entries were recorded"];
  const names = entries.map((entry) => entry.name.slice(entry.name.lastIndexOf("/") + 1).replace(/\?.*$/, "")).join(" · ");
  let wire = 0;
  let decoded = 0;
  let end = 0;
  let early = 0;
  for (const entry of entries) {
    wire += entry.transferSize;
    decoded += entry.decodedBodySize;
    end = Math.max(end, entry.responseEnd);
    if (entry.startTime < event.timeStamp) early = Math.max(early, event.timeStamp - entry.startTime);
  }
  const size = wire ? `${kb(wire)} over the network (${kb(decoded)} uncompressed)` : `${kb(decoded)} from cache`;
  const when = early > 0 ? "includes code already fetched before your click" : `in ${Math.round(Math.max(0, end - event.timeStamp))} ms`;
  return [names, ` — ${entries.length} ${entries.length === 1 ? "file" : "files"}, ${size}, ${when}`];
}

const kb = (bytes: number) => (bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1)} KB`);
