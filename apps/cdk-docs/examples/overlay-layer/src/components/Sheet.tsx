import { clientEffect, ref } from "@rivetjs/runtime/dom";
import { Overlay } from "@rivetjs/cdk/portal";
import { DismissButton } from "@rivetjs/cdk/dismiss-button";
import { modalOverlay, modalUnderlayPointerDown } from "@rivetjs/cdk/modal-overlay";
import { closeOverlay, type OverlayTriggerState } from "@rivetjs/cdk/state/overlays";

// #region demo
export function Sheet(props: { state: OverlayTriggerState }) {
  const state = props.state;
  const sheet = ref<HTMLElement>();
  // While mounted and open: Escape, outside press, scroll lock and inert outside; released on unmount.
  clientEffect(
    () => {
      const element = sheet();
      if (!element || !state.isOpen()) return;
      const release = modalOverlay(element, { isDismissable: true }, state);
      element.focus();
      return release;
    },
    { when: "load" },
  );
  return (
    // A portal at the end of body with a FocusScope: Tab stays inside, focus returns on unmount.
    <Overlay shouldContainFocus>
      <div id="sheet-backdrop" class="fixed inset-0 z-50 flex items-end bg-slate-900/40" onPointerDown={(event) => modalUnderlayPointerDown(event)}>
        <div ref={sheet} id="sheet" role="dialog" aria-modal="true" aria-label="Sheet" tabIndex={-1} class="w-full rounded-t-xl bg-white p-4 outline-none">
          {/* Visually hidden, for screen reader users without a visible close button. */}
          <DismissButton onDismiss={() => closeOverlay(state)} />
          <p>A bottom sheet built from the overlay primitives.</p>
          <button id="sheet-close" type="button" class="mt-3 rounded border border-slate-300 px-3 py-1" onClick={() => closeOverlay(state)}>
            Close
          </button>
        </div>
      </div>
    </Overlay>
  );
}
// #endregion
