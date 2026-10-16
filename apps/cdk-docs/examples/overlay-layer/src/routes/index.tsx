import { Show } from "@rivetjs/runtime/dom";
import { createOverlayTriggerState, openOverlay } from "@rivetjs/cdk/state/overlays";
import { Sheet } from "../components/Sheet.tsx";

export const head = { title: "Your own modal on the overlay layer" };

export default function Page() {
  const state = createOverlayTriggerState();
  return (
    <section class="m-4 text-sm">
      <button id="sheet-open" type="button" class="rounded-md border border-slate-300 px-3 py-1" onClick={() => openOverlay(state)}>
        Open sheet
      </button>
      {/* Created in the browser when the state opens; removed (focus restored) when it closes. */}
      <Show when={state.isOpen}>{() => <Sheet state={state} />}</Show>
    </section>
  );
}
