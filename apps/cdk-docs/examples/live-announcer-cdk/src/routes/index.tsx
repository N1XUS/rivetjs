import { signal } from "@rivetjs/reactivity";
import { clientEffect, ref } from "@rivetjs/runtime/dom";
import { getLiveAnnouncer, CdkAriaLive } from "@rivetjs/cdk/a11y/live-announcer";

export const head = { title: "Angular CDK LiveAnnouncer" };

const btn = "rounded border border-slate-300 px-2 py-1";

// #region demo
export default function Cart() {
  const count = signal(0);
  const cart = ref<HTMLParagraphElement>();
  // cdkAriaLive: announce the element's text on every change (browser only: a client effect).
  clientEffect(() => {
    const element = cart();
    if (!element) return;
    const live = new CdkAriaLive(element, "polite");
    return () => live.destroy();
  });
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <div class="flex flex-wrap gap-2">
        <button id="saved" type="button" class={btn} onClick={() => getLiveAnnouncer().announce("Saved")}>
          Saved (polite)
        </button>
        <button id="error" type="button" class={btn} onClick={() => getLiveAnnouncer().announce("Connection lost", "assertive")}>
          Error (assertive)
        </button>
        <button id="flash" type="button" class={btn} onClick={() => getLiveAnnouncer().announce("Copied", "polite", 1000)}>
          Copied (cleared after 1 s)
        </button>
        <button id="add" type="button" class={btn} onClick={() => count.update((n) => n + 1)}>
          Add to cart
        </button>
      </div>
      <p id="cart" ref={cart}>
        Cart: {count()} {count() === 1 ? "item" : "items"}
      </p>
    </section>
  );
}
// #endregion
