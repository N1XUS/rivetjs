import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Portal } from "@rivetjs/cdk/portal";

export const head = { title: "Server-rendered portal" };

// #region demo
export default function Shop() {
  const shown = signal(true);
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <div id="banner-slot" />
      <div id="ps-card" class="h-12 overflow-hidden rounded-md border border-slate-300 p-3">
        A clipped card that renders the banner.
        {/* Open on the server: rendered here in the HTML, moved to #banner-slot at load. */}
        <Show when={shown}>
          {() => (
            <Portal mount="#banner-slot" class="banner-host">
              <p id="banner" role="status" class="flex justify-between rounded-md bg-amber-100 px-3 py-2">
                Free shipping this week
                <button id="banner-close" type="button" class="underline" onClick={() => shown.set(false)}>
                  Hide
                </button>
              </p>
            </Portal>
          )}
        </Show>
      </div>
    </section>
  );
}
// #endregion
