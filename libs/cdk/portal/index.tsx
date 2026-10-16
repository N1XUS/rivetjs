// Portals that render on the server. `<Portal>` renders its children inside an owned
// `<div data-rivet-portal>`: in place in the server HTML (visible without JavaScript, indexable),
// then moved to its mount (default `document.body`) — at `load` on a resumed page, right after
// mounting when rendered in the browser. Its owner's cleanup removes it (a `<Show>` turning false,
// a re-created region, a client navigation). Because the move is a resumable `clientEffect`, a portal
// behind `<Show when>` works whether `when` starts true (server-rendered branch: moved at load) or
// false (created in the browser). Server markers inside the host stay balanced, so resumption is
// unaffected by the move.
//
// Also: `PortalProvider` (React Aria `UNSAFE_PortalProvider`: default container for portals below
// it), `Overlay` (React Aria `Overlay`: a portal + focus containment / restoration).
//
// `PortalProvider`, `Overlay` ported from @react-aria/overlays (PortalProvider.tsx, Overlay.tsx),
// Apache-2.0, © Adobe. Imperative portals / outlets (Angular CDK): ./portal-outlet.ts.
import { createContext, useContext } from "@rivetjs/reactivity";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { clientEffect, ref, Provider } from "@rivetjs/runtime/dom";
import { FocusScope } from "../focus/focus-scope.tsx";
import { ClearPressResponder } from "../interactions/pressable.tsx";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { resolveMount, type PortalMount } from "./portal-mount.ts";
import { renderSlot } from "@rivetjs/runtime/slot";

export { resolveMount, type PortalMount };

/** Default mount for portals below a `PortalProvider` (`null`: none). */
export const PortalContext = resumableContext(createContext<PortalMount>(null, { id: "rv-portal" }));

/** Set the container of every `Portal` / `Overlay` / `OverlayContainer` rendered below it. */
export function PortalProvider(props: { container?: PortalMount; children?: Content | (() => Content) }) {
  // Plain children are a lazy compiler slot rendered under the provider; function children work too.
  const children = props.children;
  return (
    <Provider token={PortalContext} value={props.container ?? null}>
      {renderSlot(children)}
    </Provider>
  );
}

export interface PortalProps {
  /** Where to render. @default the nearest PortalProvider's container, else document.body */
  mount?: PortalMount;
  /** Class of the host element. */
  class?: string;
  /**
   * Rivet: called once the host is in its mount (the move runs in a client effect, after the content's own effects
   * may have run). Content measuring its layout (popover positioning) waits for it.
   */
  onPlaced?: () => void;
  children?: Content;
}

/**
 * Render `children` at the end of `mount` (default `document.body`), inside a
 * `<div data-rivet-portal>`. Server: rendered in place and moved at `load`.
 */
export function Portal(props: PortalProps) {
  const host = ref<HTMLElement>();
  const mount = props.mount ?? useContext(PortalContext),
    onPlaced = props.onPlaced;
  clientEffect(
    () => {
      const element = host();
      if (!element) return;
      const target = resolveMount(mount);
      if (element.parentNode !== target) {
        // Moving a node blurs focus inside it (content that focused itself on mount, e.g. a menu item).
        const focused = element.ownerDocument.activeElement as HTMLElement | null;
        const inside = !!focused && element.contains(focused);
        target.append(element);
        if (inside && element.ownerDocument.activeElement !== focused) focused!.focus({ preventScroll: true });
      }
      onPlaced?.();
      return () => element.remove();
    },
    { when: "load" },
  );
  return (
    <div data-rivet-portal="" class={props.class} ref={host}>
      {props.children}
    </div>
  );
}

export interface OverlayProps {
  /** Container of the portal. @default the nearest PortalProvider's container, else document.body */
  portalContainer?: PortalMount;
  /** No focus containment / restoration (you implement both). */
  disableFocusManagement?: boolean;
  /** Keep Tab inside the overlay. React Aria turns this on for modal overlays (`useModalOverlay`). */
  shouldContainFocus?: boolean;
  /** Exit animation running: focus may leave. A value or an accessor (read when the scope mounts). */
  isExiting?: boolean | (() => boolean | undefined);
  /** Rivet: `Portal` `onPlaced` (the overlay is in its container). */
  onPlaced?: () => void;
  children?: Content;
}

/**
 * React Aria `Overlay`: a `Portal` with a `FocusScope` — focus returns to the element focused before
 * it rendered when it goes away, and with `shouldContainFocus` Tab stays inside. Its content is wrapped
 * in a `ClearPressResponder` (RA): press props of the trigger's `PressResponder` (DialogTrigger, …) do
 * not reach buttons inside the overlay.
 */
export function Overlay(props: OverlayProps) {
  const children = props.children,
    exiting = props.isExiting;
  const isExiting = typeof exiting === "function" ? !!exiting() : !!exiting;
  return (
    <Portal mount={props.portalContainer} onPlaced={props.onPlaced}>
      <ClearPressResponder>
        {props.disableFocusManagement ? (
          children
        ) : (
          <FocusScope restoreFocus contain={!!props.shouldContainFocus && !isExiting}>
            {children}
          </FocusScope>
        )}
      </ClearPressResponder>
    </Portal>
  );
}
