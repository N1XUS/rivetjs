// The Preact side of a Rivet slot: `<rivet-slot [name] style="display:contents">` with no Preact children
// (`dangerouslySetInnerHTML` empty: Preact neither diffs nor clears its content — hydration keeps the resumed Rivet
// nodes, re-renders compare the same empty HTML and leave them). Client-created islands get the Rivet-rendered nodes
// appended once mounted. Plain `h` (no JSX): this package's modules are never compiled by the Rivet compiler.
import { h, type VNode } from "preact";
import { useLayoutEffect, useRef } from "preact/hooks";

const EMPTY = { __html: "" } as const;

interface SlotProps {
  name: string;
  /** Client: the Rivet nodes of this slot (resumed nodes already in the hole, or a client-created island's content). */
  nodes?: Node[] | null;
}

/** @internal One slot hole. Attribute order = `slotMark` (`name`, then `style`): the core finds the hole by its markup. */
export function Slot({ name, nodes }: SlotProps): VNode<any> {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const hole = ref.current;
    if (hole && nodes?.length && nodes[0]!.parentNode !== hole) hole.append(...nodes);
  }, [nodes]);
  return h("rivet-slot", { ref, name: name === "default" ? undefined : name, style: "display:contents", dangerouslySetInnerHTML: EMPTY });
}

/** The prop a slot fills: `default` → `children`, a content prop by its own key. */
export const slotProp = (name: string): string => (name === "default" ? "children" : name);

/** Framework props + one `Slot` vnode per slot (keyed by name; `nodes` on the client). */
export function withSlots(props: Record<string, unknown>, names: readonly string[], nodes?: Record<string, Node[] | null>): Record<string, unknown> {
  if (!names.length) return props;
  const out: Record<string, unknown> = { ...props };
  for (const name of names) out[slotProp(name)] = h(Slot, { key: name, name, nodes: nodes?.[name] ?? null });
  return out;
}
