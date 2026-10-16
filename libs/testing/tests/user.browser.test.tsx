// `@rivetjs/testing/user` (ported @react-aria/test-utils) drives a client-rendered cdk ListBox in
// Chromium: the tester finds options, selects with mouse and keyboard, and reads selection state.
import { expect, test } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { render } from "@rivetjs/runtime/testing";
import { ListBox, type Key, type Selection } from "@rivetjs/cdk/listbox";
import { User } from "@rivetjs/testing/user";

const fruits = [
  { key: "apple", label: "Apple" },
  { key: "banana", label: "Banana" },
  { key: "cherry", label: "Cherry", disabled: true },
  { key: "date", label: "Date" },
];

test("ListBoxTester: options, mouse and keyboard selection on a cdk ListBox", async () => {
  // Two-way `selectedKeys` signal: typed `Selection` (`"all" | Set<Key>`) — the ListBox may write "all".
  const selected = signal<Selection>(new Set<Key>());
  const keys = () => {
    const value = selected();
    return value === "all" ? ["all"] : [...value];
  };
  render(() => (
    <div>
      <span id="label">Fruit</span>
      <ListBox id="fruit" aria-labelledby="label" items={fruits} selectionMode="multiple" selectedKeys={selected} />
    </div>
  ));
  const user = new User({ interactionType: "mouse" });
  const listbox = user.createTester("ListBox", { root: document.getElementById("fruit")! });
  expect(listbox.getOptions().map((option) => option.textContent)).toEqual(["Apple", "Banana", "Cherry", "Date"]);

  await listbox.toggleOptionSelection({ option: "Banana" });
  expect(keys()).toEqual(["banana"]);
  expect(listbox.getSelectedOptions().map((option) => option.textContent)).toEqual(["Banana"]);

  await listbox.toggleOptionSelection({ option: 3, interactionType: "keyboard" });
  expect(keys().sort()).toEqual(["banana", "date"]);
  expect(listbox.findOption({ indexOrText: "Cherry" }).getAttribute("aria-disabled")).toBe("true");
});
