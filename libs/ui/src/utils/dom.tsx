// Ported from HeroUI v3.2.6 packages/react/src/utils/dom.tsx (Apache-2.0, © 2025 NextUI Inc.; modified), itself
// from react-aria-components src/utils.tsx (Apache-2.0, © Adobe).
// Rivet:
// - upstream `dom` is a Proxy creating a component per intrinsic tag at runtime; Rivet compiles each element to a
//   template, so `dom` is the namespace of `./dom-tags.tsx`: one exported component per tag HeroUI uses (`dom.div`,
//   `dom.span`, …) plus `section`. Namespace member access tree-shakes: a bundle carries only the tags it uses. Add a
//   tag in `dom-tags.tsx` when a ported component needs it.
// - each component spreads its props onto the element (`{...props}` → one `_spread`, which reads every key in its
//   effect: live getter props and accessors (the spread rule for function values) both update); `{...{ render: undefined }}`
//   keeps `render` off the element; `ref={props.ref}` is explicit (a `ref` key inside a spread is ignored).
// - `DOMProps<"circle">` also takes `SVGStrokeAttrs` (`stroke-dasharray` / `-dashoffset` / `-linecap`, SVG attribute names;
//   upstream React camelCase props): Rivet's intrinsic SVG types lack them.
// - `render` is applied by each tag (cdk `render` contract): `render(props, undefined)` with `render` removed from the props;
//   props are typed loosely (`DOMRenderedProps`) so `<section {...props} />` needs no cast. Development builds warn when
//   a passed `ref()` is still empty after `render` returned (upstream message; `#dev` import: `development` → `dev-on.ts`,
//   default → `dev-off.ts` `DEV = false`, so production bundles drop the check and the message; `tests/dev-warning.test.ts`).
import type { JSX } from "@rivetjs/runtime/jsx-runtime";

/**
 * What `render` receives: the part's attributes (incl. `ref`, handlers, `children`; reactive entries are accessors). Typed
 * loosely on purpose: spreading `JSX.IntrinsicElements[E]` onto a different tag (`<section {...props} />` for a `div`) fails on
 * the element-typed event handlers, and Rivet cannot ask users to cast.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DOMRenderedProps<_E extends keyof JSX.IntrinsicElements = keyof JSX.IntrinsicElements> = Record<string, any>;
export type DOMRenderFunction<E extends keyof JSX.IntrinsicElements, T> = (props: DOMRenderedProps<E>, renderProps: T) => JSX.Element;
export interface DOMRenderProps<E extends keyof JSX.IntrinsicElements, T> {
  /**
   * Overrides the default DOM element with a custom render function.
   * This allows rendering existing components with built-in styles and behaviors
   * such as router links, animation libraries, and pre-styled components.
   *
   * Requirements:
   *
   * * You must render the expected element type (e.g. if `<button>` is expected, you cannot render an `<a>`).
   * * Only a single root DOM element can be rendered (no fragments).
   * * You must pass through props and ref to the underlying DOM element, merging with your own prop as appropriate.
   *
   * Rivet: applied by `dom.*` (early return before the compiled element); `renderProps` is `undefined` (as upstream).
   */
  render?: DOMRenderFunction<E, T>;
}

/** Attribute props that may also be `() => value` accessors (what the compiler accepts for reactive attributes); `ref`, `children`, `render` and handlers stay as typed. */
type AccessorAttrs<P> = { [K in keyof P]: K extends "ref" | "children" | "render" | `on${string}` ? P[K] : P[K] | (() => P[K]) };

/** SVG stroke presentation attributes HeroUI sets (React `strokeDasharray` / `strokeDashoffset` / `strokeLinecap`) that
 *  Rivet's intrinsic SVG types lack; written with their SVG attribute names (Rivet does not rename camelCase). */
export interface SVGStrokeAttrs {
  "stroke-dasharray"?: string | number;
  "stroke-dashoffset"?: string | number;
  "stroke-linecap"?: "butt" | "round" | "square";
}

/** Props of `dom.<E>`: the element's props (each attribute may be an accessor) + `render` (+ `SVGStrokeAttrs` on `circle`). */
export type DOMProps<E extends keyof JSX.IntrinsicElements> = DOMRenderProps<E, any> &
  AccessorAttrs<E extends "circle" ? JSX.IntrinsicElements[E] & SVGStrokeAttrs : JSX.IntrinsicElements[E]>;

export * as dom from "./dom-tags.tsx";
