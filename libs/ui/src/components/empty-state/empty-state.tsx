// Ported from HeroUI v3.2.6 packages/react/src/components/empty-state/empty-state.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: `className` → `class`; React types → Rivet JSX types. `children || "No results found"`: no children (or a falsy
//   string) renders the default text; Rivet JSX children are lazy slots (always truthy), so an element child renders as given.
//   Live props: `children` / `class` / `size` are read lazily (`splitLive`), so a changed `class` / `size` updates in place.
// - `size` sm / md / lg (Rivet addition: HeroUI v3.2.6 EmptyState has one size; identity spec §3.6).
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { EmptyStateVariants } from "../../../styles/src/components/empty-state/index.ts";
import { emptyStateVariants } from "../../../styles/src/components/empty-state/index.ts";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * EmptyState Root
 * -----------------------------------------------------------------------------------------------*/
interface EmptyStateRootProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
  /** Padding and text size: `sm` (4 px, 12 px text), `md` (default: 8 px, 14 px), `lg` (24 px, 16 px). */
  size?: EmptyStateVariants["size"];
}

/** `EmptyStateRoot` props for the default element (`div`). */
type EmptyStateRootDivProps = EmptyStateRootProps & Omit<JSX.IntrinsicElements["div"], keyof EmptyStateRootProps>;

const EmptyStateRoot = <E extends keyof JSX.IntrinsicElements = "div">(props: EmptyStateRootProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as EmptyStateRootDivProps, ["children", "class", "size"]);

  return (
    <dom.div class={emptyStateVariants({ class: local.class, size: local.size })} data-slot="empty-state" {...rest}>
      {local.children || "No results found"}
    </dom.div>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { EmptyStateRoot };

export type { EmptyStateRootProps, EmptyStateRootDivProps };
