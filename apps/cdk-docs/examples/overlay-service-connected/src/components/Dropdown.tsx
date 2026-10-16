import { signal, type Signal } from "@rivetjs/reactivity";
import { overlayService } from "@rivetjs/cdk/overlay-service";
import { DomPortal } from "@rivetjs/cdk/portal-outlet";
import type { OverlayRef } from "@rivetjs/cdk/overlay-ref";

// #region demo
// Browser-only bookkeeping (never serialized).
let ref: OverlayRef | undefined;

function toggle(trigger: HTMLElement, open: Signal<boolean>, log: Signal<string[]>) {
  if (ref?.hasAttached()) return ref.detach();
  if (!ref) {
    const overlay = overlayService();
    const strategy = overlay
      .position()
      .flexibleConnectedTo(trigger)
      .withPositions([
        // Preferred: below, start-aligned; fallback: above. Each adds its panelClass.
        { originX: "start", originY: "bottom", overlayX: "start", overlayY: "top", offsetY: 4, panelClass: "below" },
        { originX: "start", originY: "top", overlayX: "start", overlayY: "bottom", offsetY: -4, panelClass: "above" },
      ])
      .withViewportMargin(8)
      .withPush(false);
    strategy.positionChanges.subscribe((change) => log.update((l) => [...l, `${change.connectionPair.originY}→${change.connectionPair.overlayY}`]));
    ref = overlay.create({ positionStrategy: strategy, scrollStrategy: overlay.scrollStrategies.reposition(), minWidth: trigger.offsetWidth });
    const r = ref;
    r.attachments().subscribe(() => open.set(true));
    r.detachments().subscribe(() => open.set(false));
    // Clicks outside every attached overlay (the trigger toggles itself).
    r.outsidePointerEvents().subscribe((event) => {
      if (!trigger.contains(event.target as Node)) r.detach();
    });
    r.keydownEvents().subscribe((event) => {
      if (event.key === "Escape") r.detach();
    });
  }
  // An element already in the page: moved into the pane, put back on detach.
  ref.attach(new DomPortal(trigger.ownerDocument.getElementById("oc-menu")!));
}

export function Dropdown() {
  const open = signal(false);
  const log = signal<string[]>([]);
  return (
    <>
      <button
        id="oc-trigger"
        type="button"
        class="rounded-md border border-slate-300 px-3 py-1"
        aria-expanded={open() ? "true" : "false"}
        onClick={(event) => toggle(event.currentTarget, open, log)}
      >
        Newest first
      </button>
      <div id="oc-stash" hidden>
        <ul id="oc-menu" class="m-0 grid w-full list-none gap-1 rounded-md border border-slate-300 bg-white p-1 shadow-lg">
          <li class="px-2 py-1">Newest first</li>
          <li class="px-2 py-1">Oldest first</li>
          <li class="px-2 py-1">Most popular</li>
        </ul>
      </div>
      <output id="oc-log" class="font-mono text-xs">
        {log().join(" ")}
      </output>
    </>
  );
}
// #endregion
