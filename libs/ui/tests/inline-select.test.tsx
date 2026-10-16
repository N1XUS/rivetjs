// DOM-target suite: `InlineSelect` (Rivet addition; feature set inspired by HeroUI Pro's public docs, independent implementation)
// happy-dom — exports, press opens (popover classes, `aria-expanded`), option press selects + onChange, multiple selection (two-way
// Signal, popover stays open), custom indicator, as the current Breadcrumbs item (`isCurrent`), parts outside an InlineSelect.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

type Key = string | number;
const window = installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Breadcrumbs } = await import("../src/components/breadcrumbs/index.ts");
const { ListBox } = await import("../src/components/list-box/index.ts");
const M = await import("../src/components/inline-select/index.ts");
const { InlineSelect } = M;

const flush = () => new Promise((r) => setTimeout(r, 20));
const W = window as unknown as { PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent };
function press(el: Element) {
  const o = { bubbles: true, cancelable: true, pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, width: 1, height: 1, isPrimary: true };
  el.dispatchEvent(new W.PointerEvent("pointerdown", o));
  el.dispatchEvent(new W.PointerEvent("pointerup", o));
  el.dispatchEvent(new W.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
}
const q = (sel: string) => document.querySelector(sel) as HTMLElement | null;
const trigger = () => q('[data-slot="inline-select-trigger"]') as HTMLButtonElement;
const option = (text: string) => [...document.querySelectorAll("[role=option]")].find((o) => o.textContent!.includes(text)) as HTMLElement;

const Items = () => (
  <ListBox>
    <ListBox.Item id="web" textValue="Website">
      Website
      <ListBox.ItemIndicator />
    </ListBox.Item>
    <ListBox.Item id="app" textValue="Mobile app">
      Mobile app
      <ListBox.ItemIndicator />
    </ListBox.Item>
  </ListBox>
);

test("inline-select: exports", () => {
  assert.equal(InlineSelect.Root, M.InlineSelectRoot);
  for (const k of ["Trigger", "Value", "Indicator", "Popover", "Item"] as const) assert.equal(typeof InlineSelect[k], "function");
  assert.equal(typeof M.inlineSelectVariants, "function");
});

test("inline-select: press opens, option press selects + onChange", async () => {
  const changes: unknown[] = [];
  const r = render(() => (
    <InlineSelect defaultValue="web" aria-label="Project" onChange={(k: unknown) => changes.push(k)}>
      <InlineSelect.Trigger>
        <InlineSelect.Value />
        <InlineSelect.Indicator />
      </InlineSelect.Trigger>
      <InlineSelect.Popover>
        <Items />
      </InlineSelect.Popover>
    </InlineSelect>
  ));
  assert.equal(q(".inline-select__value")!.textContent, "Website");
  press(trigger());
  await flush();
  assert.equal(trigger().getAttribute("aria-expanded"), "true");
  const pop = q('[data-slot="inline-select-popover"]')!;
  assert.ok(pop.classList.contains("select__popover") && pop.classList.contains("inline-select__popover"));
  press(option("Mobile app"));
  await flush();
  assert.deepEqual(changes, ["app"]);
  assert.equal(q(".inline-select__value")!.textContent, "Mobile app");
  r.unmount();
});

test("inline-select: multiple selection, custom indicator", async () => {
  const picked = signal<readonly Key[]>(["web"]);
  const r = render(() => (
    <InlineSelect selectionMode="multiple" value={picked} aria-label="Projects">
      <InlineSelect.Trigger>
        <InlineSelect.Value />
        <InlineSelect.Indicator>
          <i class="custom" />
        </InlineSelect.Indicator>
      </InlineSelect.Trigger>
      <InlineSelect.Popover>
        <Items />
      </InlineSelect.Popover>
    </InlineSelect>
  ));
  assert.ok(q('[data-slot="inline-select-indicator"] .custom'));
  press(trigger());
  await flush();
  press(option("Mobile app"));
  await flush();
  assert.deepEqual([...picked()].sort(), ["app", "web"]);
  assert.ok(q("[role=listbox]"));
  r.unmount();
});

test("inline-select: current Breadcrumbs item (isCurrent, no separator), parts outside", async () => {
  const seen: boolean[] = [];
  const r = render(() => (
    <Breadcrumbs>
      <Breadcrumbs.Item href="/">Home</Breadcrumbs.Item>
      <Breadcrumbs.Item>
        {({ isCurrent, separator }) => {
          seen.push(isCurrent());
          return (
            <>
              <InlineSelect defaultValue="web" aria-label="Project">
                <InlineSelect.Trigger>
                  <InlineSelect.Value />
                </InlineSelect.Trigger>
                <InlineSelect.Popover>
                  <Items />
                </InlineSelect.Popover>
              </InlineSelect>
              {isCurrent() ? null : separator()}
            </>
          );
        }}
      </Breadcrumbs.Item>
    </Breadcrumbs>
  ));
  await flush();
  assert.equal(seen.at(-1), true);
  const items = document.querySelectorAll('[data-slot="breadcrumbs-item"]');
  assert.equal(items.length, 2);
  assert.ok(items[1]!.querySelector(".inline-select__trigger"));
  assert.equal(items[1]!.querySelector("a"), null);
  assert.equal(items[1]!.querySelector('[data-slot="breadcrumbs-separator"]'), null);
  assert.ok(items[0]!.querySelector('[data-slot="breadcrumbs-separator"]'));
  r.unmount();

  const r2 = render(() => <InlineSelect.Indicator class="own" />);
  assert.equal(q('[data-slot="inline-select-default-indicator"]')!.getAttribute("class"), "own");
  r2.unmount();
});

test("inline-select: auto form (items) = Trigger (Value + Indicator) + Popover + ListBox; InlineSelect.Item", async () => {
  const project = signal<Key | null>("web");
  const projects = [
    { id: "web", name: "Website" },
    { id: "app", name: "Mobile app" },
  ];
  const r = render(() => (
    <InlineSelect aria-label="Project" items={projects} value={project}>
      {(p: { id: string; name: string }) => <InlineSelect.Item id={p.id}>{p.name}</InlineSelect.Item>}
    </InlineSelect>
  ));
  const t = trigger();
  assert.ok(t.querySelector(".inline-select__value") && t.querySelector('[data-slot="inline-select-default-indicator"]'));
  assert.equal(q(".inline-select__value")!.textContent, "Website");
  press(t);
  await flush();
  assert.ok(q('[data-slot="inline-select-popover"] [role=listbox]'));
  assert.ok(option("Website").querySelector('[data-slot="list-box-item-indicator"]'));
  press(option("Mobile app"));
  await flush();
  assert.equal(project(), "app");
  assert.equal(q(".inline-select__value")!.textContent, "Mobile app");
  r.unmount();
});
