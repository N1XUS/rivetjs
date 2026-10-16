import { signal } from "@rivetjs/reactivity";
import { FocusKeyManager, elementOption } from "@rivetjs/cdk/a11y/key-manager";

export const head = { title: "FocusKeyManager" };

const fruits = ["Apple", "Banana", "Cherry", "Date", "Elderberry"];

// #region demo
type Option = ReturnType<typeof elementOption>;
/** One manager per list element, made on the first key (browser only, never serialized). */
const managers = new WeakMap<Element, FocusKeyManager<Option>>();

function managerFor(list: HTMLElement, onChange: (index: number) => void, onTabOut: () => void): FocusKeyManager<Option> {
  let manager = managers.get(list);
  if (manager) return manager;
  const items = [...list.querySelectorAll<HTMLElement>("[role=menuitem]")].map(elementOption);
  manager = new FocusKeyManager<Option>(items)
    .withWrap()
    .withHomeAndEnd()
    .withTypeAhead()
    // Replaces the default (skip disabled items): also skip sold-out ones.
    .skipPredicate((item) => item.disabled || item.element.hasAttribute("data-sold-out"));
  manager.change.subscribe((index) => {
    // Roving tabindex: the active item is the tab stop.
    items.forEach((item, i) => item.element.setAttribute("tabindex", i === index ? "0" : "-1"));
    onChange(index);
  });
  manager.tabOut.subscribe(onTabOut);
  managers.set(list, manager);
  return manager;
}

export default function FocusManagerDemo() {
  const active = signal(0);
  const log = signal<string[]>([]);
  const onKeyDown = (event: KeyboardEvent & { currentTarget: HTMLElement }) => {
    const manager = managerFor(
      event.currentTarget,
      (index) => active.set(index),
      () => log.update((l) => [...l, "tabOut"]),
    );
    // Start from the focused item (it may have been clicked).
    const items = [...event.currentTarget.querySelectorAll("[role=menuitem]")];
    manager.updateActiveItem(items.indexOf(event.target as Element));
    manager.onKeydown(event);
  };
  return (
    <section class="m-4 grid max-w-xs gap-3 text-sm">
      <div role="menu" aria-label="Fruit" data-rk="ArrowDown ArrowUp Home End" onKeyDown={onKeyDown} class="grid rounded border border-slate-300 p-1">
        {fruits.map((fruit, i) => (
          <button
            type="button"
            role="menuitem"
            id={"fk-" + fruit.toLowerCase()}
            tabIndex={i === 0 ? 0 : -1}
            aria-disabled={fruit === "Cherry" ? "true" : undefined}
            data-sold-out={fruit === "Date" ? "" : undefined}
            class="rounded px-2 py-1 text-left outline-none focus:bg-teal-600 focus:text-white aria-disabled:opacity-40 data-sold-out:line-through"
          >
            {fruit}
          </button>
        ))}
      </div>
      <p>
        Active index: <output id="fk-active">{active()}</output>
      </p>
      <p>
        Events: <output id="fk-log">{log().join(", ")}</output>
      </p>
    </section>
  );
}
// #endregion
