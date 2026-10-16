import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { sharedResizeObserver, useResizeObserver } from "@rivetjs/cdk/observers";

export const head = { title: "Resize observers" };

// #region demo
export default function Resize() {
  const wide = signal(false);
  const width = signal(0);
  const entries = signal(0);
  let box!: HTMLDivElement;
  // react-aria useResizeObserver: onResize() on every size change; returns the cleanup.
  clientEffect(() => useResizeObserver({ ref: box, onResize: () => width.set(box.offsetWidth) }));
  // Angular SharedResizeObserver: one ResizeObserver per box type for the whole app.
  clientEffect(() => {
    const subscription = sharedResizeObserver()
      .observe(box, { box: "border-box" })
      .subscribe(() => entries.update((n) => n + 1));
    return () => subscription.unsubscribe();
  });
  return (
    <section class="m-4 grid gap-2 text-sm">
      <button
        id="toggle"
        type="button"
        class="justify-self-start rounded-md bg-teal-700 px-3 py-1 font-semibold text-white"
        onClick={() => wide.update((w) => !w)}
      >
        {wide() ? "Make narrow" : "Make wide"}
      </button>
      <div id="box" ref={(el) => (box = el)} style={{ width: wide() ? "240px" : "120px" }} class="h-12 rounded bg-teal-100 transition-none" />
      <p id="width">Width: {width()}px</p>
      <p id="entries">Shared observer callbacks: {entries()}</p>
    </section>
  );
}
// #endregion
