// Portal mount resolution (browser only), kept out of the component module.

/**
 * Where a portal renders: a CSS selector (resolved in the browser; serializable, so it works on
 * resumed pages), an element `ref()`, an element or a function returning one (browser-rendered
 * portals only: elements and plain functions do not serialize).
 */
export type PortalMount = string | Element | null | undefined | (() => Element | null | undefined);

/** Resolve a mount to an element (`document.body` when missing). */
export function resolveMount(mount: PortalMount): Element {
  const value = typeof mount === "function" ? mount() : mount;
  const element = typeof value === "string" ? document.querySelector(value) : value;
  return element ?? document.body;
}
