// Ported from HeroUI v3.2.6 packages/react/src/utils/dom.tsx (Apache-2.0, © 2025 NextUI Inc.; modified), itself
// from react-aria-components src/utils.tsx (Apache-2.0, © Adobe).
// Rivet: the `dom.<tag>` components, one named export per tag (`./dom.tsx` re-exports this module as the `dom`
// namespace, so unused tags tree-shake). `render`: early return BEFORE the unchanged compiled element (a JSX fallback
// callback would break resume); the render function gets the props (incl. `ref`, handlers, lazily resolved `children`)
// with `render` removed. See `./dom.tsx` for the deviations.
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";
import { DEV } from "#dev";

import type { DOMProps } from "./dom.tsx";

/** The props as the element's JSX props: accessor attributes are bound by the runtime spread, JSX spread typing does not know them. */
const intrinsic = <E extends keyof JSX.IntrinsicElements>(props: DOMProps<E>): JSX.IntrinsicElements[E] => props as unknown as JSX.IntrinsicElements[E];

/** Upstream `dom.tsx` wording (React Aria / HeroUI). */
const REF_MESSAGE = "Ref was not connected to DOM element returned by custom `render` function. Did you forget to pass through or merge the `ref`?";

/**
 * The `render` path shared by every tag: `render(props without render, undefined)` (upstream passes `undefined` render props).
 * Lazy JSX `children` resolve once; a user function stays an accessor as is (a wrapper arrow is not serializable: resume would lose the spread site). Development: a `ref()` signal passed in that is still
 * empty a microtask after the render function returned was dropped by it (browser only: no elements on the server).
 */
function rendered(props: object): JSX.Element {
  const { render, children, ...attrs } = props as { render: (props: unknown, renderProps: undefined) => JSX.Element; children?: unknown };
  const out: Record<string, unknown> = attrs;
  if (children !== undefined) out.children = typeof children === "function" && !isSlot(children) ? children : renderSlot(children);
  const element = render(out, undefined);
  if (DEV && typeof document !== "undefined") {
    const r = out.ref as (() => unknown) | undefined;
    if (typeof r === "function" && "set" in r) queueMicrotask(() => r() === undefined && console.warn(REF_MESSAGE));
  }
  return element;
}

export const abbr = (props: DOMProps<"abbr">): JSX.Element => {
  if (props.render) return rendered(props);
  return <abbr {...intrinsic(props)} {...{ render: undefined }} />;
};

export const button = (props: DOMProps<"button">): JSX.Element => {
  if (props.render) return rendered(props);
  return <button {...intrinsic(props)} {...{ render: undefined }} />;
};

export const circle = (props: DOMProps<"circle">): JSX.Element => {
  if (props.render) return rendered(props);
  return <circle {...intrinsic(props)} {...{ render: undefined }} />;
};

export const div = (props: DOMProps<"div">): JSX.Element => {
  if (props.render) return rendered(props);
  return <div {...intrinsic(props)} {...{ render: undefined }} />;
};

export const fieldset = (props: DOMProps<"fieldset">): JSX.Element => {
  if (props.render) return rendered(props);
  return <fieldset {...intrinsic(props)} {...{ render: undefined }} />;
};

export const h3 = (props: DOMProps<"h3">): JSX.Element => {
  if (props.render) return rendered(props);
  return <h3 {...intrinsic(props)} {...{ render: undefined }} />;
};

export const header = (props: DOMProps<"header">): JSX.Element => {
  if (props.render) return rendered(props);
  return <header {...intrinsic(props)} {...{ render: undefined }} />;
};

export const kbd = (props: DOMProps<"kbd">): JSX.Element => {
  if (props.render) return rendered(props);
  return <kbd {...intrinsic(props)} {...{ render: undefined }} />;
};

export const legend = (props: DOMProps<"legend">): JSX.Element => {
  if (props.render) return rendered(props);
  return <legend {...intrinsic(props)} {...{ render: undefined }} />;
};

export const li = (props: DOMProps<"li">): JSX.Element => {
  if (props.render) return rendered(props);
  return <li {...intrinsic(props)} {...{ render: undefined }} />;
};

export const nav = (props: DOMProps<"nav">): JSX.Element => {
  if (props.render) return rendered(props);
  return <nav {...intrinsic(props)} {...{ render: undefined }} />;
};

export const p = (props: DOMProps<"p">): JSX.Element => {
  if (props.render) return rendered(props);
  return <p {...intrinsic(props)} {...{ render: undefined }} />;
};

export const section = (props: DOMProps<"section">): JSX.Element => {
  if (props.render) return rendered(props);
  return <section {...intrinsic(props)} {...{ render: undefined }} />;
};

export const span = (props: DOMProps<"span">): JSX.Element => {
  if (props.render) return rendered(props);
  return <span {...intrinsic(props)} {...{ render: undefined }} />;
};

export const svg = (props: DOMProps<"svg">): JSX.Element => {
  if (props.render) return rendered(props);
  return <svg {...intrinsic(props)} {...{ render: undefined }} />;
};

export const tbody = (props: DOMProps<"tbody">): JSX.Element => {
  if (props.render) return rendered(props);
  return <tbody {...intrinsic(props)} {...{ render: undefined }} />;
};

export const thead = (props: DOMProps<"thead">): JSX.Element => {
  if (props.render) return rendered(props);
  return <thead {...intrinsic(props)} {...{ render: undefined }} />;
};

export const ul = (props: DOMProps<"ul">): JSX.Element => {
  if (props.render) return rendered(props);
  return <ul {...intrinsic(props)} {...{ render: undefined }} />;
};
