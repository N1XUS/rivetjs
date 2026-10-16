// Slot holes: the adapter renders `SlotMark.html` where Rivet content goes; the core splits the framework HTML at the
// holes and writes the Rivet content in place, as Rivet server values (never rendered to a string and re-parsed).
import type { SlotMark } from "./adapter.ts";

const CLOSE = "</rivet-slot>";
const attr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** The hole of slot `name` (`"default"` = `children`, written without a `name` attribute). */
export function slotMark(name: string): SlotMark {
  return { name, html: "<rivet-slot" + (name === "default" ? "" : ' name="' + attr(name) + '"') + ' style="display:contents">' + CLOSE };
}

/**
 * Split framework HTML at the holes: `parts[i]` ends with hole `i`'s open tag, `parts[i + 1]` starts with its close
 * tag, so the content goes between them; `order[i]` = the slot name of hole `i` (document order; a hole found twice
 * is listed twice, a mark not found is absent — the caller reports both).
 */
export function splitSlots(html: string, marks: readonly SlotMark[]): { parts: string[]; order: string[] } {
  const hits: [at: number, mark: SlotMark][] = [];
  for (const mark of marks) for (let at = html.indexOf(mark.html); at !== -1; at = html.indexOf(mark.html, at + mark.html.length)) hits.push([at, mark]);
  if (hits.length > 1) hits.sort((a, b) => a[0] - b[0]);
  const parts: string[] = [],
    order: string[] = [];
  let from = 0;
  for (const [at, mark] of hits) {
    const cut = at + mark.html.length - CLOSE.length;
    parts.push(html.slice(from, cut));
    order.push(mark.name);
    from = cut;
  }
  parts.push(html.slice(from));
  return { parts, order };
}
