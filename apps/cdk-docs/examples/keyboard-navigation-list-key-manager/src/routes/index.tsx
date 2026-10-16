import { signal, type Signal } from "@rivetjs/reactivity";
import { ListKeyManager } from "@rivetjs/cdk/a11y/key-manager";
import { direction } from "@rivetjs/cdk/bidi";

export const head = { title: "ListKeyManager" };

// #region demo
// Plain data items: the manager reads `disabled` (and `getLabel()` for typeahead).
const sizes = [{ label: "XS" }, { label: "S" }, { label: "M", disabled: true }, { label: "L" }, { label: "XL" }];
type Size = (typeof sizes)[number];

const managers = new WeakMap<Element, ListKeyManager<Size>>();

function managerFor(group: HTMLElement, active: Signal<number>): ListKeyManager<Size> {
  let manager = managers.get(group);
  if (manager) return manager;
  manager = new ListKeyManager(sizes).withHorizontalOrientation(direction(group)).withVerticalOrientation(false).withAllowedModifierKeys(["shiftKey"]);
  // The manager only tracks the index: render it, and move focus yourself.
  manager.change.subscribe((index) => {
    active.set(index);
    group.querySelectorAll("button")[index]?.focus();
  });
  managers.set(group, manager);
  return manager;
}

function Sizes(props: { id: string; label: string }) {
  const active = signal(0);
  const { id } = props;
  return (
    <div class="flex items-center gap-3">
      <div
        role="toolbar"
        id={id}
        aria-label={props.label}
        data-rk="ArrowLeft ArrowRight"
        onKeyDown={(event) => {
          const manager = managerFor(event.currentTarget, active);
          manager.updateActiveItem(active());
          manager.onKeydown(event);
        }}
        class="flex gap-1"
      >
        {sizes.map((size, i) => (
          <button
            type="button"
            id={id + "-" + size.label.toLowerCase()}
            tabIndex={active() === i ? 0 : -1}
            disabled={size.disabled}
            onClick={() => active.set(i)}
            class="rounded border border-slate-300 px-2 py-1 focus:bg-teal-600 focus:text-white disabled:opacity-40"
          >
            {size.label}
          </button>
        ))}
      </div>
      <output id={id + "-value"}>{sizes[active()]!.label}</output>
      <button
        type="button"
        id={id + "-last"}
        class="text-teal-700 underline"
        onClick={() => {
          const group = document.getElementById(id)!;
          managerFor(group, active).setLastItemActive();
        }}
      >
        Last
      </button>
    </div>
  );
}

export default function ListKeyManagerDemo() {
  return (
    <section class="m-4 grid gap-3 text-sm">
      <Sizes id="lk" label="Size" />
      <div dir="rtl">
        <Sizes id="rtl" label="Size (right-to-left)" />
      </div>
    </section>
  );
}
// #endregion
