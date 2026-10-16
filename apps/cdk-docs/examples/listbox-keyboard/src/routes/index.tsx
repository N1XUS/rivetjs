import { signal } from "@rivetjs/reactivity";
import { ListBox, type Key, type Selection } from "@rivetjs/cdk/listbox";

export const head = { title: "ListBox keyboard options" };

const planets = ["Mercury", "Venus", "Earth", "Mars"].map((label) => ({ key: label.toLowerCase(), label }));

const show = (keys: Selection) => (keys === "all" ? "all" : [...keys].map(String).sort().join(", ") || "none");

// #region demo
export default function Planets() {
  const kept = signal<Selection>(new Set<Key>(["venus", "mars"]));
  return (
    <section class="m-4 grid grid-cols-2 gap-4 text-sm">
      <div class="grid content-start gap-1">
        <span class="font-semibold">shouldFocusWrap</span>
        <ListBox id="wrap" aria-label="Planets (wrapping)" items={planets} shouldFocusWrap />
      </div>
      <div class="grid content-start gap-1">
        <span class="font-semibold">escapeKeyBehavior="none"</span>
        <ListBox id="keep" aria-label="Planets (Escape keeps)" items={planets} selectionMode="multiple" selectedKeys={kept} escapeKeyBehavior="none" />
        <p id="keep-value" class="text-slate-600">
          {show(kept())}
        </p>
      </div>
    </section>
  );
}
// #endregion
