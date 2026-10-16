// `render` prop helper (RAC `DOMRenderProps` / `DOMRenderFunction`).
// Ported from react-spectrum packages/react-aria-components/src/utils.tsx (Apache-2.0, © Adobe).
// Rivet: no `useRenderProps` hook. When `render` is given a part builds its attribute object (incl. `ref`, `class`,
// `style`, handlers, `children`; reactive entries are accessors) and calls `render(attrs, renderProps)`: spread it
// onto the element to render (`ref` inside a spread applies). Without `render` the part's compiled element is unchanged.
// `renderProps` is the part's render-props object of accessors (`isPressed()` …) or `undefined` (RAC passes
// `undefined` for parts without render props). `render` must be an inline arrow (resumable rule).
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";

export type DOMRenderFunction<E extends keyof JSX.IntrinsicElements, T> = (props: JSX.IntrinsicElements[E], renderProps: T) => JSX.Element;

export interface DOMRenderProps<E extends keyof JSX.IntrinsicElements, T> {
  /** Overrides the default DOM element with a custom render function; spread the received props onto the element you render. */
  render?: DOMRenderFunction<E, T>;
}

/**
 * The part's attributes go to `render` when given, else to the default element (`fallback`).
 * Rivet parts do NOT use this with a JSX `fallback` arrow: a compiled element in a callback loses the part's
 * resumable bindings (reactive `children`, adopted server nodes). Parts write `if (render) return render(attrs, rp);`
 * before their compiled element instead; this stays for non-JSX fallbacks and as the documented contract.
 */
export function renderElement<E extends keyof JSX.IntrinsicElements, T>(
  render: DOMRenderFunction<E, T> | undefined,
  props: JSX.IntrinsicElements[E],
  renderProps: T,
  fallback: (props: JSX.IntrinsicElements[E]) => JSX.Element,
): JSX.Element {
  return render ? render(props, renderProps) : fallback(props);
}

/**
 * Client/SSR fresh-render only (a new arrow in a `.ts` module is not resumable): used only on the `render` path, which never
 * adopts server nodes. `children` for a part's attributes object: lazy JSX content is resolved once; a user function is reactive
 * content, so it stays an accessor (the element's spread re-renders the content when its reads change).
 */
export function slotChildren<T>(children: T | (() => T)): unknown {
  return typeof children === "function" && !isSlot(children) ? () => renderSlot(children) : renderSlot(children);
}
