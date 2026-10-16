// Ported from HeroUI v3.2.6 packages/react/src/components/skeleton/skeleton.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `className` → `class`; `React.useMemo` → module-level `slotsFor` memo (tv slot functions are pure) keyed on the resolved
//   animation type (`undefined` → the tv default `shimmer`).
// - `useCSSVariable("--skeleton-animation", animationType)` is a plain function: the server (and a resumed page, which keeps the
//   server markup) renders the default animation class; a client-created Skeleton reads the root variable at creation (cached per
//   name, so the class binding re-reads it for free).
// - Live props: `animationType` / `class` are read lazily (`splitLive`) in the class binding (a changed prop updates in place).
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

import type { SkeletonVariants } from "../../../styles/src/components/skeleton/index.ts";
import { skeletonVariants } from "../../../styles/src/components/skeleton/index.ts";
import { useCSSVariable } from "../../hooks/use-css-variable.ts";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { splitLive } from "../../utils/live.tsx";

type SkeletonSlots = ReturnType<typeof skeletonVariants>;

/** Module-level memo per resolved animation type (`"default"` = the variants' own default). */
const SLOTS: Record<string, SkeletonSlots> = {};
const slotsFor = (animationType: SkeletonVariants["animationType"]): SkeletonSlots =>
  (SLOTS[animationType ?? "default"] ??= skeletonVariants({ animationType }));

/* -------------------------------------------------------------------------------------------------
 * Skeleton Root
 * -----------------------------------------------------------------------------------------------*/
interface SkeletonRootProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  class?: string;
  /** Animation type. */
  animationType?: SkeletonVariants["animationType"];
}

/** `SkeletonRoot` props for the default element (`div`). */
type SkeletonRootDivProps = SkeletonRootProps & Omit<JSX.IntrinsicElements["div"], keyof SkeletonRootProps>;

const SkeletonRoot = <E extends keyof JSX.IntrinsicElements = "div">(props: SkeletonRootProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as SkeletonRootDivProps, ["animationType", "class"]);
  // Use the hook to get the CSS variable value with SSR support
  const resolvedAnimationType = () => useCSSVariable("--skeleton-animation", local.animationType) as SkeletonVariants["animationType"];

  return <dom.div class={slotsFor(resolvedAnimationType()).base({ class: local.class })} {...rest} />;
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { SkeletonRoot };

export type { SkeletonRootProps, SkeletonRootDivProps };
