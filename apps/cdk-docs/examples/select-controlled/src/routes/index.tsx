import { signal } from "@rivetjs/reactivity";
import { Select, type Key } from "@rivetjs/cdk/select";

export const head = { title: "Controlled Select" };

const sizes = [
  { key: "s", label: "Small" },
  { key: "m", label: "Medium" },
  { key: "l", label: "Large" },
];

// #region demo
export default function Sizes() {
  // Controlled: the select reads and writes these signals; so can any other code.
  const size = signal<Key | null>("m");
  const open = signal(false);
  return (
    <section class="m-4 grid max-w-sm justify-items-start gap-3 text-sm">
      <Select id="size" label="Size (controlled)" items={sizes} value={size} isOpen={open} />
      <div class="flex gap-2">
        <button type="button" id="pick-large" class="rounded border px-2 py-1" onClick={() => size.set("l")}>
          Large
        </button>
        <button type="button" id="pick-none" class="rounded border px-2 py-1" onClick={() => size.set(null)}>
          Clear
        </button>
        <button type="button" id="open-size" class="rounded border px-2 py-1" onClick={() => open.set(true)}>
          Open
        </button>
      </div>
      <p id="size-out" class="text-slate-600">
        value: {String(size())}, open: {String(open())}
      </p>
      {/* Uncontrolled: defaultValue is only the initial value. */}
      <Select id="fit" label="Fit (uncontrolled)" items={sizes} defaultValue="s" />
    </section>
  );
}
// #endregion
