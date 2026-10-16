import { signal, type Signal } from "@rivetjs/reactivity";
import { overlay } from "@rivetjs/cdk/overlay";
import { overlayPosition } from "@rivetjs/cdk/position";
import { focusFirst, saveFocus } from "@rivetjs/cdk/focus";

// #region demo
// Browser-only bookkeeping for the open panel (never serialized).
let close: (() => void) | null = null;

function show(open: Signal<boolean>, trigger: HTMLElement) {
  const panel = trigger.ownerDocument.getElementById(trigger.getAttribute("aria-controls")!)!;
  const restore = saveFocus(panel);
  panel.hidden = false;
  open.set(true);
  // React Aria geometry: flips when there is no room, follows resizes.
  const position = overlayPosition({ target: trigger, overlay: panel, placement: "bottom start", offset: 4, onClose: () => close?.() });
  // Escape (focus inside) and interaction outside close it; the trigger toggles it itself.
  const stopOverlay = overlay(panel, {
    onClose: () => close?.(),
    isDismissable: true,
    shouldCloseOnInteractOutside: (element) => !trigger.contains(element),
  });
  focusFirst(panel);
  close = () => {
    const refocus = panel.contains(panel.ownerDocument.activeElement);
    stopOverlay();
    position.dispose();
    panel.hidden = true;
    open.set(false);
    close = null;
    if (refocus) restore();
  };
}

export function FilterButton() {
  const open = signal(false);
  const toggle = (event: MouseEvent & { currentTarget: HTMLButtonElement }) => (close ? close() : show(open, event.currentTarget));
  return (
    <div>
      <button
        id="filters-trigger"
        type="button"
        class="rounded-md border border-slate-300 px-3 py-1"
        aria-expanded={open() ? "true" : "false"}
        aria-controls="filters"
        onClick={toggle}
      >
        Filters
      </button>
      <div id="filters" hidden role="dialog" aria-label="Filters" class="grid gap-2 rounded-md border border-slate-300 bg-white p-3 shadow-lg">
        <label>
          <input type="checkbox" id="in-stock" /> In stock
        </label>
        <label>
          <input type="checkbox" id="on-sale" /> On sale
        </label>
      </div>
    </div>
  );
}
// #endregion
