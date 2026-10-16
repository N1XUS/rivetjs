import { ref } from "@rivetjs/runtime/dom";
import { FocusTrap } from "@rivetjs/cdk/a11y/focus-trap";

export const head = { title: "FocusTrap" };

const field = "rounded border border-slate-300 px-2 py-1";

// #region demo
// The trap is a browser object: keep it outside component state, create it in a handler.
const live: { trap?: FocusTrap } = {};

export default function Address() {
  const region = ref<HTMLDivElement>();
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <button
        id="trap"
        type="button"
        class="justify-self-start rounded-md border border-slate-300 px-3 py-1"
        onClick={() => {
          live.trap ??= new FocusTrap(region()!);
          live.trap.focusInitialElement();
        }}
      >
        Edit address
      </button>
      <div id="region" ref={region} class="grid gap-2 rounded-md border border-teal-700 p-3">
        <input id="street" aria-label="Street" class={field} />
        <input id="city" aria-label="City" class={field} cdk-focus-initial="" />
        <button
          id="ok"
          type="button"
          class="justify-self-start rounded-md bg-teal-700 px-3 py-1 font-semibold text-white"
          onClick={() => {
            live.trap?.destroy();
            live.trap = undefined;
          }}
        >
          Done
        </button>
      </div>
    </section>
  );
}
// #endregion
