import { ref } from "@rivetjs/runtime/dom";
import { ConfigurableFocusTrapFactory, type ConfigurableFocusTrap } from "@rivetjs/cdk/a11y/focus-trap";

export const head = { title: "ConfigurableFocusTrap" };

const btn = "rounded border border-slate-300 px-2 py-1";

// #region demo
const live: { trap?: ConfigurableFocusTrap } = {};

export default function Wizard() {
  const region = ref<HTMLDivElement>();
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <div class="flex gap-2">
        <button
          id="start"
          type="button"
          class={btn}
          onClick={() => {
            // Registers with the shared FocusTrapManager: earlier traps are disabled until this one goes.
            live.trap ??= new ConfigurableFocusTrapFactory().create(region()!);
            live.trap.focusFirstTabbableElement();
          }}
        >
          Start
        </button>
        <button id="outside" type="button" class={btn}>
          Outside
        </button>
      </div>
      <div ref={region} class="flex gap-2 rounded-md border border-teal-700 p-3">
        <button id="one" type="button" class={btn}>
          Step one
        </button>
        <button
          id="stop"
          type="button"
          class={btn}
          onClick={() => {
            live.trap?.destroy();
            live.trap = undefined;
          }}
        >
          Stop trapping
        </button>
      </div>
    </section>
  );
}
// #endregion
