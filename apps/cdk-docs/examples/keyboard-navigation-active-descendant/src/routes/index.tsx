import { signal } from "@rivetjs/reactivity";
import { ActiveDescendantKeyManager, elementOption } from "@rivetjs/cdk/a11y/key-manager";

export const head = { title: "ActiveDescendantKeyManager" };

const items = Array.from({ length: 8 }, (_, i) => `Item ${i + 1}`);

// #region demo
type Option = ReturnType<typeof elementOption>;
const managers = new WeakMap<Element, ActiveDescendantKeyManager<Option>>();

function managerFor(list: HTMLElement): ActiveDescendantKeyManager<Option> {
  let manager = managers.get(list);
  if (manager) return manager;
  const options = [...list.querySelectorAll<HTMLElement>("[role=option]")].map(elementOption);
  // elementOption: setActiveStyles / setInactiveStyles toggle data-active.
  manager = new ActiveDescendantKeyManager<Option>(options).withHomeAndEnd().withPageUpDown(true, 3);
  manager.change.subscribe((index) => list.setAttribute("aria-activedescendant", options[index]!.element.id));
  managers.set(list, manager);
  return manager;
}

export default function ActiveDescendant() {
  const selected = signal<string | null>(null);
  const onKeyDown = (event: KeyboardEvent & { currentTarget: HTMLElement }) => {
    const manager = managerFor(event.currentTarget);
    if (event.key === "Enter" && manager.activeItem) {
      event.preventDefault();
      selected.set(manager.activeItem.element.textContent);
      return;
    }
    manager.onKeydown(event);
  };
  return (
    <section class="m-4 grid max-w-xs gap-3 text-sm">
      <div
        id="ad"
        role="listbox"
        tabIndex={0}
        aria-label="Items"
        data-rk="ArrowDown ArrowUp Home End PageUp PageDown"
        onKeyDown={onKeyDown}
        class="grid rounded border border-slate-300 p-1 outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
      >
        {items.map((label, i) => (
          <div
            role="option"
            id={"ad-" + (i + 1)}
            aria-selected={selected() === label ? "true" : "false"}
            class="rounded px-2 py-0.5 data-active:bg-teal-600 data-active:text-white aria-selected:font-semibold"
          >
            {label}
          </div>
        ))}
      </div>
      <p>
        Selected: <output id="ad-value">{selected() ?? "none"}</output>
      </p>
    </section>
  );
}
// #endregion
