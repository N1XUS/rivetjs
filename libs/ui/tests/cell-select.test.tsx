// DOM-target suite: `CellSelect` (Rivet addition; feature set inspired by HeroUI Pro's public docs, independent implementation)
// happy-dom — exports, part classes, press opens + option press selects (value text + onChange), two-way Signal value, multiple
// selection, disabled, custom indicator child, live variant, parts outside a CellSelect.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

type Key = string | number;
const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { ListBox } = await import("../src/components/list-box/index.ts");
const M = await import("../src/components/cell-select/index.ts");
const { CellSelect } = M;

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}
const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const trigger = () => q('[data-slot="cell-select-trigger"]') as HTMLButtonElement;
const option = (text: string) => [...document.querySelectorAll("[role=option]")].find((o) => o.textContent!.includes(text)) as HTMLElement;

const Items = () => (
  <ListBox>
    <ListBox.Item id="en" textValue="English">
      English
      <ListBox.ItemIndicator />
    </ListBox.Item>
    <ListBox.Item id="de" textValue="Deutsch">
      Deutsch
      <ListBox.ItemIndicator />
    </ListBox.Item>
  </ListBox>
);

test("cell-select: exports", () => {
  assert.equal(CellSelect.Root, M.CellSelectRoot);
  for (const k of ["Trigger", "Label", "Value", "Indicator", "Popover", "Item"] as const) assert.equal(typeof CellSelect[k], "function");
  assert.equal(typeof M.cellSelectVariants, "function");
});

test("cell-select: press opens, option press selects (value + onChange), popover classes", async () => {
  const changes: unknown[] = [];
  const r = render(() => (
    <CellSelect defaultValue="en" onChange={(k: unknown) => changes.push(k)}>
      <CellSelect.Trigger>
        <CellSelect.Label>Language</CellSelect.Label>
        <CellSelect.Value />
        <CellSelect.Indicator />
      </CellSelect.Trigger>
      <CellSelect.Popover>
        <Items />
      </CellSelect.Popover>
    </CellSelect>
  ));
  assert.equal(q(".cell-select__value")!.textContent, "English");
  assert.equal(q(".cell-select__label")!.tagName, "SPAN");
  press(trigger());
  await flush();
  const pop = q('[data-slot="cell-select-popover"]')!;
  assert.ok(pop.classList.contains("select__popover") && pop.classList.contains("cell-select__popover"));
  assert.equal(q('[data-slot="cell-select-default-indicator"]')!.getAttribute("data-open"), "true");
  press(option("Deutsch"));
  await flush();
  assert.deepEqual(changes, ["de"]);
  assert.equal(q(".cell-select__value")!.textContent, "Deutsch");
  assert.equal(q("[role=listbox]"), null);
  r.unmount();
});

test("cell-select: two-way Signal value, multiple selection", async () => {
  const lang = signal<Key | null>("en");
  const r = render(() => (
    <CellSelect value={lang} aria-label="Language">
      <CellSelect.Trigger>
        <CellSelect.Value />
      </CellSelect.Trigger>
      <CellSelect.Popover>
        <Items />
      </CellSelect.Popover>
    </CellSelect>
  ));
  lang.set("de");
  await flush();
  assert.equal(q(".cell-select__value")!.textContent, "Deutsch");
  r.unmount();

  const many = signal<readonly Key[]>(["en"]);
  const r2 = render(() => (
    <CellSelect selectionMode="multiple" value={many} aria-label="Languages">
      <CellSelect.Trigger>
        <CellSelect.Value />
      </CellSelect.Trigger>
      <CellSelect.Popover>
        <Items />
      </CellSelect.Popover>
    </CellSelect>
  ));
  press(trigger());
  await flush();
  press(option("Deutsch"));
  await flush();
  assert.deepEqual([...many()].sort(), ["de", "en"]);
  assert.ok(q("[role=listbox]"), "multiple selection keeps the popover open");
  r2.unmount();
});

test("cell-select: disabled, custom indicator, live variant, parts outside", async () => {
  const variant = signal<"default" | "secondary">("default");
  const r = render(() => (
    <CellSelect isDisabled variant={variant()} aria-label="X">
      <CellSelect.Trigger>
        <CellSelect.Value />
        <CellSelect.Indicator>
          <i class="custom" />
        </CellSelect.Indicator>
      </CellSelect.Trigger>
      <CellSelect.Popover>
        <Items />
      </CellSelect.Popover>
    </CellSelect>
  ));
  assert.ok(trigger().disabled);
  const ind = q('[data-slot="cell-select-indicator"]')!;
  assert.equal(ind.className, "cell-select__indicator");
  assert.ok(ind.querySelector(".custom"));
  const before = trigger();
  variant.set("secondary");
  await flush();
  assert.equal(trigger(), before);
  assert.ok(trigger().classList.contains("cell-select__trigger--secondary"));
  r.unmount();

  const r2 = render(() => <CellSelect.Label class="own">Alone</CellSelect.Label>);
  assert.equal(q('[data-slot="cell-select-label"]')!.className, "own");
  r2.unmount();
});

test("cell-select: auto form (label) = compound shapes; CellSelect.Item = ListBox.Item + indicator, textValue from text", async () => {
  const r = render(() => (
    <CellSelect label="Language" defaultValue="de">
      <CellSelect.Item id="en">English</CellSelect.Item>
      <CellSelect.Item id="de">Deutsch</CellSelect.Item>
    </CellSelect>
  ));
  const t = trigger();
  assert.equal(t.querySelector(".cell-select__label")!.textContent, "Language");
  assert.ok(t.querySelector(".cell-select__value") && t.querySelector('[data-slot="cell-select-default-indicator"]'));
  assert.equal(q(".cell-select__value")!.textContent, "Deutsch");
  press(t);
  await flush();
  assert.ok(q('[data-slot="cell-select-popover"] [role=listbox]'));
  assert.equal(option("Deutsch").getAttribute("aria-selected"), "true");
  assert.ok(option("Deutsch").querySelector('[data-slot="list-box-item-indicator"]'));
  press(option("English"));
  await flush();
  assert.equal(q(".cell-select__value")!.textContent, "English");
  r.unmount();
});

test("cell-select: auto form (items + render function), two-way value", async () => {
  const lang = signal<Key | null>("en");
  const langs = [
    { id: "en", name: "English" },
    { id: "fr", name: "Français" },
  ];
  const r = render(() => (
    <CellSelect label="Language" items={langs} value={lang}>
      {(l: { id: string; name: string }) => <CellSelect.Item id={l.id}>{l.name}</CellSelect.Item>}
    </CellSelect>
  ));
  press(trigger());
  await flush();
  assert.equal(document.querySelectorAll("[role=option]").length, 2);
  press(option("Français"));
  await flush();
  assert.equal(lang(), "fr");
  assert.equal(q(".cell-select__value")!.textContent, "Français");
  r.unmount();
});
