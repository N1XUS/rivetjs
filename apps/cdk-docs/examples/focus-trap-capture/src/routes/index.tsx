import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Panel } from "../components/Panel.tsx";

export const head = { title: "CdkTrapFocus with autoCapture" };

// #region demo
export default function Page() {
  const open = signal(false);
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <button id="open" type="button" class="justify-self-start rounded-md border border-slate-300 px-3 py-1" onClick={() => open.set(true)}>
        Edit name
      </button>
      <Show when={open}>{() => <Panel onClose={() => open.set(false)} />}</Show>
    </section>
  );
}
// #endregion
