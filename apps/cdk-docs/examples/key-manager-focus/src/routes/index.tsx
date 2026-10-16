import { signal } from "@rivetjs/reactivity";
import { clientEffect, ref } from "@rivetjs/runtime/dom";
import { FocusKeyManager, elementOption } from "@rivetjs/cdk/a11y/key-manager";

export const head = { title: "FocusKeyManager" };

const fruits = [
  { id: "apple", label: "Apple" },
  { id: "banana", label: "Banana" },
  { id: "cherry", label: "Cherry", disabled: true },
  { id: "date", label: "Date" },
];

// #region demo
// The manager is a browser object (created in a client effect), kept outside component state.
type Option = { element: HTMLElement };
const live: { manager?: FocusKeyManager<Option> } = {};

export default function Fruits() {
  const list = ref<HTMLUListElement>();
  const active = signal(0);
  clientEffect(() => {
    const element = list();
    if (!element) return;
    // elementOption: DOM elements as items (disabled from aria-disabled, label from text, focus()).
    const items = [...element.querySelectorAll<HTMLElement>("[role=option]")].map(elementOption);
    const manager = (live.manager = new FocusKeyManager<Option>(items).withWrap().withHomeAndEnd().withTypeAhead());
    manager.updateActiveItem(active());
    const subscription = manager.change.subscribe((index) => active.set(index));
    return () => {
      subscription.unsubscribe();
      manager.destroy();
    };
  });
  return (
    <section class="m-4 grid max-w-xs gap-3 text-sm">
      <ul ref={list} role="listbox" aria-label="Fruit" class="grid gap-1" onKeyDown={(e) => live.manager?.onKeydown(e)}>
        {fruits.map((fruit, index) => (
          <li
            id={fruit.id}
            role="option"
            aria-disabled={fruit.disabled ? "true" : undefined}
            aria-selected={active() === index ? "true" : "false"}
            tabIndex={active() === index ? 0 : -1}
            class="rounded px-2 py-1 outline-none aria-disabled:text-slate-400 focus-visible:bg-teal-100 aria-selected:font-semibold"
          >
            {fruit.label}
          </li>
        ))}
      </ul>
      <p id="active">Active index: {active()}</p>
    </section>
  );
}
// #endregion
