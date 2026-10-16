import { signal, type Signal } from "@rivetjs/reactivity";
import { overlayService } from "@rivetjs/cdk/overlay-service";
import { TemplatePortal } from "@rivetjs/cdk/portal-outlet";
import type { OverlayRef } from "@rivetjs/cdk/overlay-ref";

// #region demo
// Browser-only: the overlay is created on the first click (never serialized).
let ref: OverlayRef | undefined;

function create(log: Signal<string[]>): OverlayRef {
  const overlay = overlayService();
  const r = overlay.create({
    // Centered horizontally, 2rem from the top of the viewport.
    positionStrategy: overlay.position().global().centerHorizontally().top("2rem"),
    scrollStrategy: overlay.scrollStrategies.block(),
    hasBackdrop: true,
    width: "18rem",
  });
  r.attachments().subscribe(() => log.update((l) => [...l, "attached"]));
  r.detachments().subscribe(() => log.update((l) => [...l, "detached"]));
  r.backdropClick().subscribe(() => r.detach());
  // Keydowns go to the top-most overlay that listens, wherever focus is.
  r.keydownEvents().subscribe((event) => {
    if (event.key === "Escape") r.detach();
  });
  return r;
}

function open(log: Signal<string[]>) {
  ref ??= create(log);
  if (ref.hasAttached()) return;
  // A render function with a context, like Angular's TemplateRef.
  const portal = new TemplatePortal(
    (context: { title: string }) => (
      <div id="og-panel" role="dialog" aria-label={context.title} class="w-full rounded-lg bg-white p-4 shadow-xl">
        <h2 class="font-semibold">{context.title}</h2>
        <p>Placed by the global position strategy.</p>
      </div>
    ),
    { title: "Release 2.0" },
  );
  ref.attach(portal);
}

export function Announce() {
  const log = signal<string[]>([]);
  return (
    <>
      <button id="og-open" type="button" class="rounded-md border border-slate-300 px-3 py-1" onClick={() => open(log)}>
        What is new?
      </button>
      <output id="og-log" class="font-mono text-xs">
        {log().join(" ")}
      </output>
    </>
  );
}
// #endregion
