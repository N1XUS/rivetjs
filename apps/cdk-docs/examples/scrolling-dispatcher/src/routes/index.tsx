import { signal } from "@rivetjs/reactivity";
import { CdkScrollable, scrollDispatcher } from "@rivetjs/cdk/scrolling";

export const head = { title: "ScrollDispatcher" };

// #region demo
export default function Dispatcher() {
  const status = signal("Not listening");
  const ancestors = signal("");
  const last = signal("none");
  const ancestorLast = signal("none");
  // Browser-only setup, run from an event handler: register both panels and subscribe.
  const listen = () => {
    const dispatcher = scrollDispatcher();
    if (dispatcher.scrollContainers.size) return;
    for (const id of ["panel-a", "panel-b"]) new CdkScrollable(document.getElementById(id)!).init();
    // 0 ms: no audit time (default 20 ms throttle).
    dispatcher.scrolled(0).subscribe((target) => last.set(target ? target.getElementRef().nativeElement.id : "document"));
    const marker = document.getElementById("marker")!;
    dispatcher.ancestorScrolled(marker, 0).subscribe((target) => ancestorLast.set(target ? target.getElementRef().nativeElement.id : "document"));
    status.set(`${dispatcher.scrollContainers.size} registered scrollables`);
    ancestors.set(
      dispatcher
        .getAncestorScrollContainers(marker)
        .map((s) => s.getElementRef().nativeElement.id)
        .join(", "),
    );
  };
  return (
    <section class="stack">
      <button id="dispatch-listen" type="button" onClick={listen}>
        Register and listen
      </button>
      <div class="panels">
        <div id="panel-a" class="panel">
          <div class="tall">
            <span id="marker">Marker</span> inside panel A
          </div>
        </div>
        <div id="panel-b" class="panel">
          <div class="tall">Panel B</div>
        </div>
      </div>
      <output id="dispatch-status">{status()}</output>
      <output id="dispatch-ancestors">ancestors of the marker: {ancestors()}</output>
      <output id="dispatch-last">scrolled(): {last()}</output>
      <output id="dispatch-ancestor-last">ancestorScrolled(): {ancestorLast()}</output>
    </section>
  );
}
// #endregion
