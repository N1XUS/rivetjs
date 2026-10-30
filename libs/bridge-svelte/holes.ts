// One snippet implementation on both sides: SSR writes the core's exact hole and hydration adopts its existing nodes.
import { createRawSnippet, type Snippet } from "svelte";
import type { SlotMark } from "@rivetjs/bridge/adapter";

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
const hole = (name: string) => "<rivet-slot" + (name === "default" ? "" : ' name="' + escape(name) + '"') + ' style="display:contents"></rivet-slot>';

export function withSlots(props: Record<string, unknown>, slots: Record<string, SlotMark | Node[] | null>): Record<string, unknown> {
  const result = { ...props };
  const legacy: Record<string, Snippet> = {};
  for (const [name, slot] of Object.entries(slots)) {
    const snippet = createRawSnippet(() => ({
      render: () => (slot && !Array.isArray(slot) ? slot.html : hole(name)),
      setup(element) {
        if (Array.isArray(slot)) for (const node of slot) if (node.parentNode !== element) element.appendChild(node);
      },
    }));
    result[name === "default" ? "children" : name] = snippet;
    legacy[name] = snippet;
  }
  if (Object.keys(legacy).length) result.$$slots = legacy;
  return result;
}
