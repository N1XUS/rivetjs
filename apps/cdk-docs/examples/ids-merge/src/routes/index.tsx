import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { idSignal, mergeIds, useSlotId } from "@rivetjs/cdk/id";

export const head = { title: "idSignal, mergeIds and useSlotId" };

const btn = "rounded border border-slate-300 px-2 py-1";

// #region demo
export default function Ids() {
  const root = ref<HTMLElement>();
  const slots = signal("not checked");
  const merged = signal("");
  return (
    <section ref={root} class="m-4 grid max-w-md gap-2 text-sm">
      <p id="hint">A hint is rendered; the error slot is not.</p>
      <div class="flex gap-2">
        <button
          id="check"
          type="button"
          class={btn}
          onClick={() => slots.set(`hint: ${useSlotId("hint", root()) ?? "none"}, error: ${useSlotId("error", root()) ?? "none"}`)}
        >
          useSlotId
        </button>
        <button
          id="merge"
          type="button"
          class={btn}
          onClick={() => {
            // A reactive id (created in the browser, browser-only bookkeeping) …
            const label = idSignal("label-draft");
            const element = document.getElementById("label")!;
            element.dataset.id = label();
            // … that mergeIds switches to the other id.
            const result = mergeIds("label-draft", "field-label");
            element.dataset.id = label();
            merged.set(`merged into ${result}`);
          }}
        >
          mergeIds
        </button>
      </div>
      <span id="label">Label element</span>
      <output id="slots" class="block font-mono text-xs">
        {slots()}
      </output>
      <output id="merged" class="block font-mono text-xs">
        {merged()}
      </output>
    </section>
  );
}
// #endregion
