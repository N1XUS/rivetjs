// Modal providers (React Aria `ModalProvider` / `OverlayProvider` / `OverlayContainer` / `useModal`):
// while a modal is open, every provider *around* the one containing it is `aria-hidden`, so only
// the top-most modal is reachable by screen readers. React counts modals through context; Rivet
// links providers at render time instead (an `OverlayContainer` records its logical parent provider
// in `data-rv-modal-parent`, which survives the portal move), and `modal()` — called when the modal
// opens, in a handler — walks that chain, counting per provider (`data-rv-modal-count`).
// For portaled modals (the overlay layer).
//
// Ported from @react-aria/overlays (useModal.tsx), Apache-2.0, © Adobe.
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { createId } from "../utils/id.ts";
import { Portal, PortalContext, type PortalMount } from "../portal/index.tsx";
import { renderSlot } from "@rivetjs/runtime/slot";

/**
 * Children of the providers below: content (plain JSX children are a lazy compiler slot rendered
 * under the provider, `renderSlot`) or a function returning it.
 */
export type ProviderChildren = Content | (() => Content);
const content = (children: ProviderChildren | undefined): Content => renderSlot(children) as Content;

/** Id of the enclosing modal provider element (render time). */
export const ModalProviderContext = createContext<string | null>(null);

/** Attributes of a modal provider element: `data-overlay-container`, its id, its parent provider. */
export function modalProviderProps(id: string, parent: string | null = null): Record<string, string | undefined> {
  return { "data-overlay-container": "", id, "data-rv-modal-parent": parent ?? undefined };
}

/**
 * Make `children` belong to the provider element with id `id` (render it with
 * `modalProviderProps(id, parent)`); React Aria `ModalProvider` (+ `useModalProvider`).
 */
export function ModalProvider(props: { id: string; children?: ProviderChildren }) {
  const children = props.children;
  return (
    <Provider token={ModalProviderContext} value={props.id}>
      {content(children)}
    </Provider>
  );
}

/** A root that is `aria-hidden` while a modal of a nested provider is open (React Aria `OverlayProvider`). */
export function OverlayProvider(props: { id?: string; class?: string; children?: ProviderChildren }) {
  const id = props.id ?? createId();
  const parent = useContext(ModalProviderContext);
  // Read before the JSX: an element with a spread resumes as one binding over all its attributes,
  // and reading `props` there would capture the whole props object (children included).
  const className = props.class;
  return (
    <div {...modalProviderProps(id, parent)} class={className}>
      <ModalProvider id={id}>{props.children}</ModalProvider>
    </div>
  );
}

/**
 * Overlays like modals rendered in a portal at the end of body (or `portalContainer`), inside their
 * own provider; the providers around it are hidden while a modal inside is open.
 */
export function OverlayContainer(props: { portalContainer?: PortalMount; class?: string; children?: ProviderChildren }) {
  const container = props.portalContainer ?? useContext(PortalContext);
  return (
    <Portal mount={container}>
      <OverlayProvider class={props.class}>{props.children}</OverlayProvider>
    </Portal>
  );
}

export interface AriaModalOptions {
  isDisabled?: boolean;
}

/** Attributes of the modal content element (`data-ismodal`, for the aria-modal polyfill). */
export function modalProps(options?: AriaModalOptions): { "data-ismodal": boolean } {
  return { "data-ismodal": !options?.isDisabled };
}

const COUNT = "data-rv-modal-count";

function adjust(provider: HTMLElement, by: number): void {
  const count = Math.max(0, (Number(provider.getAttribute(COUNT)) || 0) + by);
  if (count) {
    provider.setAttribute(COUNT, String(count));
    provider.setAttribute("aria-hidden", "true");
  } else {
    provider.removeAttribute(COUNT);
    provider.removeAttribute("aria-hidden");
  }
}

/**
 * The modal `element` opened (React Aria `useModal`): hide every provider above the one containing
 * it (its logical parents). Returns the release function. Throws when `element` is not inside a
 * provider, like React Aria.
 */
export function modal(element: Element, options?: AriaModalOptions): () => void {
  const own = element.closest<HTMLElement>("[data-overlay-container]");
  if (!own) throw new Error("Modal is not contained within a provider");
  if (options?.isDisabled) return () => {};
  const doc = element.ownerDocument;
  const parents: HTMLElement[] = [];
  // The immediate provider stays visible; its parents are hidden.
  for (let id = own.getAttribute("data-rv-modal-parent"); id;) {
    const parent = doc.getElementById(id);
    if (!parent || parents.includes(parent)) break;
    parents.push(parent);
    id = parent.getAttribute("data-rv-modal-parent");
  }
  // A provider outside any OverlayContainer: DOM ancestors are its parents.
  if (!parents.length)
    for (let p = own.parentElement?.closest<HTMLElement>("[data-overlay-container]"); p; p = p.parentElement?.closest<HTMLElement>("[data-overlay-container]"))
      parents.push(p);
  for (const parent of parents) adjust(parent, 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    for (const parent of parents) adjust(parent, -1);
  };
}
