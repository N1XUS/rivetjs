// Ported from HeroUI v3.2.6 packages/react/src/components/surface/surface.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped (resume, no hydration pass); `className` → `class`; React types → Rivet JSX types.
// - `createContext<SurfaceContext>({})` + `<SurfaceContext value>` → a context token (same `{}` default) + `Provider`;
//   the value is data (`{ variant }`, serializes on resume) whose
//   `variant` is a getter over the live prop (`React.useMemo` → that object; the body never re-runs).
// - Props are read lazily (`splitLive` = runtime `splitProps`): a destructure would snapshot the live getters. The body casts `props` to the
//   default-element shape (upstream casts `rest as any`): a split of the generic intersection is TS2590.
import { createContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";

import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import { surfaceVariants } from "../../../styles/src/components/surface/index.ts";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { splitLive } from "../../utils/live.tsx";

/* ------------------------------------------------------------------------------------------------
 * Surface Context
 * --------------------------------------------------------------------------------------------- */
type SurfaceContext = {
  variant?: SurfaceVariants["variant"];
};

const SurfaceContext = createContext<SurfaceContext>({});

/* ------------------------------------------------------------------------------------------------
 * Surface Root
 * --------------------------------------------------------------------------------------------- */
interface SurfaceRootProps<E extends keyof JSX.IntrinsicElements = "div"> extends DOMRenderProps<E, undefined> {
  children: Content;
  class?: string;
  /** Visual variant. @default "default" */
  variant?: SurfaceVariants["variant"];
}

/** `SurfaceRoot` props for the default element (`div`); `index.ts` types `Surface["Props"]` with it. */
type SurfaceRootDivProps = SurfaceRootProps & Omit<JSX.IntrinsicElements["div"], keyof SurfaceRootProps>;

// Upstream `Omit<JSX.IntrinsicElements[E], keyof SurfaceRootProps<E>>`: an `Omit` of the generic indexed type is TS2590
// (union too complex) at JSX sites passing a function-valued attribute (seen with `ref`, `onClick`) over Rivet's intrinsic
// map, so the element props are intersected instead (the overlapping keys `class` / `children` narrow to ours).
const SurfaceRoot = <E extends keyof JSX.IntrinsicElements = "div">(props: SurfaceRootProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as SurfaceRootDivProps, ["children", "class", "variant"]);
  const contextValue: SurfaceContext = {
    get variant() {
      return local.variant === undefined ? "default" : local.variant;
    },
  };

  return (
    <Provider token={SurfaceContext} value={contextValue}>
      <dom.div class={surfaceVariants({ variant: contextValue.variant, class: local.class })} data-slot="surface" {...rest}>
        {local.children}
      </dom.div>
    </Provider>
  );
};

/* ------------------------------------------------------------------------------------------------
 * Exports
 * --------------------------------------------------------------------------------------------- */
export { SurfaceRoot, SurfaceContext };

export type { SurfaceRootProps, SurfaceRootDivProps };
