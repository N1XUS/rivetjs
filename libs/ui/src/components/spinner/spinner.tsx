// Ported from HeroUI v3.2.6 packages/react/src/components/spinner/spinner.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `className` → `class`; React types → Rivet JSX types; `"use client"` dropped.
// - `SpinnerPrimitive`: upstream inlines a gradient `<svg>` (two arc `<path>`s + two `linearGradient`s, `useId`). Icon rule: no
//   hand-written paths → lucide `LoaderCircle` via `@rivetjs/kit/icon` (`data-slot="spinner-icon"`, `viewBox 0 0 24 24`,
//   `aria-hidden`). Visual diff: a stroked 3/4 arc without the gradient fade; spinning is the `.spinner` CSS animation, unchanged.
// - Live props: `class` / `color` / `size` are read lazily (`splitLive`) in the class binding (a changed prop updates in place).
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { Icon } from "@rivetjs/kit/icon";
import { LoaderCircle } from "lucide";

import type { SpinnerVariants } from "../../../styles/src/components/spinner/index.ts";
import { spinnerVariants } from "../../../styles/src/components/spinner/index.ts";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Spinner Root
 * -----------------------------------------------------------------------------------------------*/
interface SpinnerRootProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  class?: string;
  /** Spinner color. */
  color?: SpinnerVariants["color"];
  /** Spinner size. */
  size?: SpinnerVariants["size"];
}

/** `SpinnerRoot` props for the default element (`span`). */
type SpinnerRootSpanProps = SpinnerRootProps & Omit<JSX.IntrinsicElements["span"], keyof SpinnerRootProps>;

const SpinnerRoot = <E extends keyof JSX.IntrinsicElements = "span">(props: SpinnerRootProps<E> & JSX.IntrinsicElements[E]): JSX.Element => {
  const [local, rest] = splitLive(props as SpinnerRootSpanProps, ["class", "color", "size"]);

  return (
    <dom.span
      aria-label="Loading"
      data-slot="spinner"
      role="status"
      {...rest}
      class={spinnerVariants({ class: local.class, color: local.color, size: local.size })}
    >
      <Icon icon={LoaderCircle} size="100%" data-slot="spinner-icon" aria-hidden="true" />
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { SpinnerRoot };

export type { SpinnerRootProps, SpinnerRootSpanProps };
