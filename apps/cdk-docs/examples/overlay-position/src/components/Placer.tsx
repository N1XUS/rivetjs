import { signal, type Signal } from "@rivetjs/reactivity";
import { overlayPosition, type Placement, type PositionAria } from "@rivetjs/cdk/position";

// #region demo
// Browser-only: the engine handle of the panel (never serialized).
let position: PositionAria | undefined;

function place(doc: Document, placement: Placement, result: Signal<string>) {
  position?.dispose();
  const panel = doc.getElementById("op-panel")!;
  panel.hidden = false;
  position = overlayPosition({
    target: doc.getElementById("op-target"),
    overlay: panel,
    placement,
    offset: 8,
    containerPadding: 12,
    // A scroll of the target's scroll parent would call onClose; null: never close.
    onClose: null,
  });
  // The side after flipping (a signal), "top" | "bottom" | "left" | "right".
  result.set(String(position.placement()));
}

export function Placer() {
  const result = signal("none");
  return (
    <section class="grid gap-4 p-4 text-sm">
      <div class="flex flex-wrap gap-2">
        {(["top", "right", "bottom", "left"] as const).map((placement) => (
          <button
            id={"op-" + placement}
            type="button"
            class="rounded border border-slate-300 px-2 py-1"
            onClick={(event) => place(event.currentTarget.ownerDocument, placement, result)}
          >
            {placement}
          </button>
        ))}
        <output id="op-result" class="self-center font-mono">
          {result()}
        </output>
      </div>
      <div class="grid h-72 place-items-center rounded border border-dashed border-slate-300">
        <span id="op-target" class="rounded bg-teal-700 px-3 py-2 text-white">
          Target
        </span>
      </div>
      <div id="op-panel" hidden class="rounded bg-slate-900 px-2 py-1 text-xs text-white">
        Placed panel
      </div>
    </section>
  );
}
// #endregion
