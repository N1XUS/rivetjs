import { signal } from "@rivetjs/reactivity";
import { ListBox, ListBoxItem, type Key, type Selection } from "@rivetjs/cdk/listbox";

export const head = { title: "ListBox orientation and layout" };

const sizes = ["XS", "S", "M", "L", "XL"].map((label) => ({ key: label.toLowerCase(), label }));
const swatches = ["Red", "Orange", "Yellow", "Green", "Blue", "Indigo"].map((label) => ({ key: label.toLowerCase(), label }));

// #region demo
export default function Layouts() {
  const size = signal<Selection>(new Set<Key>(["m"]));
  const colours = signal<Selection>(new Set<Key>());
  return (
    <section class="m-4 grid gap-4 text-sm">
      <ListBox
        id="sizes"
        aria-label="Size"
        items={sizes}
        orientation="horizontal"
        selectionMode="single"
        selectionBehavior="replace"
        selectedKeys={size}
        class="rv-ListBox flex gap-1"
      >
        {(item: (typeof sizes)[number]) => (
          <ListBoxItem id={item.key} class="rv-ListBoxItem rounded border border-slate-300 px-3 py-1">
            {item.label}
          </ListBoxItem>
        )}
      </ListBox>
      <p id="size-value" class="text-slate-600">
        Size: {[...(size() as Set<Key>)].join(", ")}
      </p>
      {/* Grid layout: arrow keys follow the rendered rows and columns. */}
      <ListBox
        id="swatches"
        aria-label="Colours"
        items={swatches}
        layout="grid"
        selectionMode="multiple"
        selectedKeys={colours}
        class="rv-ListBox grid w-72 grid-cols-3 gap-1"
      >
        {(item: (typeof swatches)[number]) => (
          <ListBoxItem id={item.key} class="rv-ListBoxItem rounded border border-slate-300 px-2 py-1 text-center">
            {item.label}
          </ListBoxItem>
        )}
      </ListBox>
    </section>
  );
}
// #endregion
