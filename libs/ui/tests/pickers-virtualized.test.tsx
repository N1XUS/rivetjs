// Opt-in ListBox composition inside the three picker popovers. happy-dom supplies no layout.
import { afterEach, test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();
// Node 26 also defines CustomEvent; dispatched events must belong to happy-dom.
globalThis.CustomEvent = window.CustomEvent as unknown as typeof CustomEvent;
const { render } = await import("@rivetjs/runtime/testing");
const { ListBox } = await import("../src/components/list-box/index.ts");
const { Select } = await import("../src/components/select/index.ts");
const { ComboBox } = await import("../src/components/combo-box/index.ts");
const { Autocomplete } = await import("../src/components/autocomplete/index.ts");
const { Input } = await import("../src/components/input/index.ts");
const { SearchField } = await import("../src/components/search-field/index.ts");
const { signal } = await import("@rivetjs/reactivity");

const items = Array.from({ length: 10000 }, (_, id) => ({ id: String(id), name: id === 5000 ? "Zebra" : `Item ${id}` }));
const flush = () => new Promise((resolve) => setTimeout(resolve, 30));
const q = (selector: string) => document.querySelector<HTMLElement>(selector)!;
const options = () => document.querySelectorAll('[role="option"]');
function press(el: Element) {
  const init = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, isPrimary: true };
  el.dispatchEvent(new PointerEvent("pointerdown", init));
  el.dispatchEvent(new PointerEvent("pointerup", init));
  el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}
async function key(value: string) {
  document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }));
  document.activeElement!.dispatchEvent(new KeyboardEvent("keyup", { key: value, bubbles: true, cancelable: true }));
  await flush();
  q('[role="listbox"]')?.dispatchEvent(new Event("scroll"));
  await flush();
}
function focusedKey() {
  const active = document.activeElement;
  const id = active?.getAttribute("aria-activedescendant");
  return (id ? document.getElementById(id) : active)?.getAttribute("data-key");
}
function VirtualList() {
  return (
    <ListBox
      virtualized
      items={items}
      initialSize={{ width: 280, height: 180 }}
      style={{ height: "180px", maxHeight: "100%", minHeight: 0 }}
      ref={(el) => {
        if (!el) return;
        el.getBoundingClientRect = () => new DOMRect(0, 0, 280, 180);
        Object.defineProperties(el, {
          clientWidth: { configurable: true, value: 280 },
          clientHeight: { configurable: true, value: 180 },
          offsetWidth: { configurable: true, value: 280 },
          offsetHeight: { configurable: true, value: 180 },
          scrollHeight: { configurable: true, value: 360000 },
        });
      }}
    >
      {(item: { id: string; name: string }) => (
        <ListBox.Item
          id={item.id}
          textValue={item.name}
          ref={(el) => {
            if (!el) return;
            el.getBoundingClientRect = () => new DOMRect(0, Number(item.id) * 36 - (el.closest<HTMLElement>('[role="listbox"]')?.scrollTop ?? 0), 280, 36);
          }}
        >
          {item.name}
        </ListBox.Item>
      )}
    </ListBox>
  );
}
let mounted: { unmount(): void } | undefined;
afterEach(() => {
  mounted?.unmount();
  document.body.innerHTML = "";
});

for (const kind of ["select", "combo-box", "autocomplete"] as const) {
  test(`${kind}: virtualized 10k popover navigates, scrolls and selects the last option`, async () => {
    const value = signal<string | number | null>(null);
    mounted = render(() => {
      if (kind === "select")
        return (
          <Select aria-label="Items" value={value}>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover style={{ maxHeight: "240px" }}>
              <VirtualList />
            </Select.Popover>
          </Select>
        );
      if (kind === "combo-box")
        return (
          <ComboBox aria-label="Items" selectedKey={value}>
            <ComboBox.InputGroup>
              <Input />
              <ComboBox.Trigger />
            </ComboBox.InputGroup>
            <ComboBox.Popover style={{ maxHeight: "240px" }}>
              <VirtualList />
            </ComboBox.Popover>
          </ComboBox>
        );
      return (
        <Autocomplete aria-label="Items" value={value}>
          <Autocomplete.Trigger>
            <Autocomplete.Value />
            <Autocomplete.Indicator />
          </Autocomplete.Trigger>
          <Autocomplete.Popover style={{ maxHeight: "240px" }}>
            <Autocomplete.Filter filter={(text, input) => text.toLowerCase().includes(input.toLowerCase())}>
              <SearchField autoFocus aria-label="Search items" />
              <VirtualList />
            </Autocomplete.Filter>
          </Autocomplete.Popover>
        </Autocomplete>
      );
    });
    await flush();
    press(q(`[data-slot="${kind === "autocomplete" ? "autocomplete-value" : `${kind}-trigger`}"]`));
    for (let i = 0; i < 100 && !options().length; i++) await flush();
    assert.ok(options().length > 0 && options().length < 100, `window size ${options().length}`);
    if (kind === "select") q('[role="listbox"]').focus();
    else q(kind === "combo-box" ? "input[role=combobox]" : "input[type=search]").focus();
    await key("ArrowDown");
    await key("End");
    assert.equal(focusedKey(), "9999", `End focus: ${document.activeElement?.outerHTML}; rows ${[...options()].map((el) => el.getAttribute("data-key"))}`);
    assert.ok(q('[role="listbox"]').scrollTop >= 359820, `scrollTop ${q('[role="listbox"]').scrollTop}`);
    assert.ok(options().length < 100);
    await key("Home");
    assert.equal(focusedKey(), "0");
    assert.equal(q('[role="listbox"]').scrollTop, 0);
    for (let i = 0; i < 8; i++) await key("ArrowDown");
    assert.equal(focusedKey(), "8");
    assert.ok(q('[role="listbox"]').scrollTop > 0);
    if (kind === "select") {
      await key("z");
      assert.equal(focusedKey(), "5000");
      await key("Enter");
      assert.equal(value(), "5000");
      press(q('[data-slot="select-trigger"]'));
      await flush();
      q('[role="listbox"]').focus();
    } else {
      const input = q(kind === "combo-box" ? "input[role=combobox]" : "input[type=search]") as HTMLInputElement;
      input.value = "Zebra";
      input.dispatchEvent(new InputEvent("input", { bubbles: true, data: "Zebra", inputType: "insertText" }));
      await flush();
      assert.equal(options().length, 1);
      assert.equal(options()[0].getAttribute("data-key"), "5000");
      press(options()[0]);
      await flush();
      assert.equal(value(), "5000");
      press(q(`[data-slot="${kind === "autocomplete" ? "autocomplete-value" : "combo-box-trigger"}"]`));
      await flush();
      const search = q(kind === "combo-box" ? "input[role=combobox]" : "input[type=search]") as HTMLInputElement;
      search.focus();
      search.value = "";
      search.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
      await flush();
      await key("ArrowDown");
    }
    await key("End");
    assert.equal(focusedKey(), "9999", `End focus: ${document.activeElement?.outerHTML}; rows ${[...options()].map((el) => el.getAttribute("data-key"))}`);
    await key("Enter");
    assert.equal(value(), "9999");
  });
}
