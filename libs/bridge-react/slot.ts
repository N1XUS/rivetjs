// The React side of a Rivet slot: `<rivet-slot [name] style="display:contents">` with no React children (React leaves
// its content alone: hydration keeps the resumed Rivet nodes, updates never touch them). Client-created islands get
// the Rivet-rendered nodes appended once mounted. Plain `createElement` (no JSX): this package's modules are never
// compiled by the Rivet compiler, and `.ts` keeps them out of Rivet's `.tsx` test loader too.
import { createElement, memo, useLayoutEffect, useRef, type ReactElement } from "react";

const STYLE = { display: "contents" } as const;
const EMPTY = { __html: "" } as const;

interface SlotProps {
  name: string;
  /** Client: the Rivet nodes of this slot (resumed nodes already in the hole, or a client-created island's content). */
  nodes?: Node[] | null;
}

function RivetSlot({ name, nodes }: SlotProps): ReactElement {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const hole = ref.current;
    if (hole && nodes?.length && nodes[0]!.parentNode !== hole) hole.append(...nodes);
  }, [nodes]);
  // Attribute order = `slotMark` (`name`, then `style`): the core finds the hole by its exact markup.
  return createElement("rivet-slot", {
    ref,
    name: name === "default" ? undefined : name,
    style: STYLE,
    dangerouslySetInnerHTML: EMPTY,
    suppressHydrationWarning: true,
  });
}

/** @internal Memoized: a parent re-render never re-renders a hole. */
export const Slot = memo(RivetSlot);

/** The prop a slot fills: `default` → `children`, a content prop by its own key. */
export const slotProp = (name: string): string => (name === "default" ? "children" : name);

/** Framework props + one `Slot` element per slot (keyed by name; `nodes` on the client). */
export function withSlots(props: Record<string, unknown>, names: readonly string[], nodes?: Record<string, Node[] | null>): Record<string, unknown> {
  if (!names.length) return props;
  const out: Record<string, unknown> = { ...props };
  for (const name of names) out[slotProp(name)] = createElement(Slot, { key: name, name, nodes: nodes?.[name] ?? null });
  return out;
}
