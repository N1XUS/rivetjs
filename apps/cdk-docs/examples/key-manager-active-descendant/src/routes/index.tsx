import { signal } from "@rivetjs/reactivity";
import { clientEffect, ref } from "@rivetjs/runtime/dom";
import { ActiveDescendantKeyManager, elementOption } from "@rivetjs/cdk/a11y/key-manager";

export const head = { title: "ActiveDescendantKeyManager" };

const cities = ["Berlin", "Lisbon", "Oslo"];

// #region demo
type Option = { element: HTMLElement };
const live: { manager?: ActiveDescendantKeyManager<Option> } = {};

export default function City() {
  const list = ref<HTMLUListElement>();
  const activeId = signal<string | undefined>(undefined);
  const chosen = signal("none");
  clientEffect(() => {
    const element = list();
    if (!element) return;
    // elementOption's setActiveStyles / setInactiveStyles toggle data-active.
    const items = [...element.querySelectorAll<HTMLElement>("[role=option]")].map(elementOption);
    const manager = (live.manager = new ActiveDescendantKeyManager<Option>(items).withWrap());
    const subscription = manager.change.subscribe(() => activeId.set(manager.activeItem?.element.id));
    return () => {
      subscription.unsubscribe();
      manager.destroy();
    };
  });
  const onKeyDown = (e: KeyboardEvent) => {
    const manager = live.manager;
    if (!manager) return;
    if (e.key === "Enter" && manager.activeItem) {
      chosen.set(manager.activeItem.getLabel!());
      e.preventDefault();
    } else manager.onKeydown(e);
  };
  return (
    <section class="m-4 grid max-w-xs gap-2 text-sm">
      <label for="city">City</label>
      <input
        id="city"
        role="combobox"
        aria-expanded="true"
        aria-controls="cities"
        aria-activedescendant={activeId()}
        class="rounded border border-slate-300 px-2 py-1"
        onKeyDown={onKeyDown}
      />
      <ul id="cities" ref={list} role="listbox" aria-label="Cities" class="grid gap-1 rounded border border-slate-200 p-1">
        {cities.map((city) => (
          <li id={"opt-" + city.toLowerCase()} role="option" class="rounded px-2 py-1 data-[active]:bg-teal-100">
            {city}
          </li>
        ))}
      </ul>
      <p id="chosen">Chosen: {chosen()}</p>
    </section>
  );
}
// #endregion
