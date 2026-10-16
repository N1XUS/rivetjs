// DOM-target suite: `Accordion` (upstream tests/components/accordion/accordion.test.tsx ported to happy-dom): data-slot +
// BEM block + part slots; `variant="surface"` modifier; expanding via the trigger; single expansion by default; multiple with
// `allowsMultipleExpanded`; `onExpandedChange` keys; disabled item; indicator `data-expanded`; `data-hide-separator`.
// Keyboard (Tab / Enter / Space) on a real browser: `tests-components/accordion.test.ts`. Rivet: part classes, panel
// `data-expanded`, two-way `expandedKeys` signal, custom indicator children (span wrapper), SurfaceContext, live variant,
// parts outside an Accordion, index exports.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal, useContext } = await import("@rivetjs/reactivity");
const ui = await import("../src/components/accordion/index.ts");
const { SurfaceContext } = await import("../src/components/surface/index.ts");
const { Accordion } = ui;

const flush = () => new Promise((r) => setTimeout(r, 20));

const Items = () => (
  <>
    <Accordion.Item id="faq-1">
      <Accordion.Heading>
        <Accordion.Trigger>
          How do I place an order?
          <Accordion.Indicator />
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body>Browse our products and proceed to checkout.</Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
    <Accordion.Item id="faq-2">
      <Accordion.Heading>
        <Accordion.Trigger>
          Can I modify my order?
          <Accordion.Indicator />
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body>Yes, before it ships.</Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
    <Accordion.Item isDisabled id="faq-3">
      <Accordion.Heading>
        <Accordion.Trigger>
          Disabled question
          <Accordion.Indicator />
        </Accordion.Trigger>
      </Accordion.Heading>
      <Accordion.Panel>
        <Accordion.Body>Never shown.</Accordion.Body>
      </Accordion.Panel>
    </Accordion.Item>
  </>
);

const renderAccordion = (props: Record<string, unknown> = {}) =>
  render(() => (
    <Accordion data-testid="accordion" {...props}>
      <Items />
    </Accordion>
  ));

const all = (root: ParentNode, sel: string) => [...root.querySelectorAll<HTMLElement>(sel)];
const button = (root: ParentNode, name: string) =>
  all(root, '[data-slot="accordion-trigger"]').find((b) => b.textContent?.trim() === name) as HTMLButtonElement;
const panelOf = (b: HTMLElement) => b.closest('[data-slot="accordion-item"]')!.querySelector('[data-slot="accordion-panel"]') as HTMLElement;
const visible = (b: HTMLElement) => !panelOf(b).hasAttribute("hidden");

test("exposes data-slot, BEM block, and compound part slots", () => {
  const r = renderAccordion();
  const root = r.container.querySelector('[data-testid="accordion"]')!;
  assert.equal(root.getAttribute("data-slot"), "accordion");
  assert.match(root.className, /\baccordion\b/);
  for (const s of ["accordion-item", "accordion-trigger", "accordion-heading", "accordion-panel", "accordion-indicator"])
    assert.equal(all(r.container, `[data-slot="${s}"]`).length, 3, s);
  // Rivet: the part classes.
  assert.match(all(r.container, '[data-slot="accordion-item"]')[0]!.className, /accordion__item/);
  assert.match(all(r.container, '[data-slot="accordion-trigger"]')[0]!.className, /accordion__trigger/);
  assert.match(all(r.container, '[data-slot="accordion-heading"]')[0]!.className, /accordion__heading/);
  assert.match(all(r.container, '[data-slot="accordion-panel"]')[0]!.className, /accordion__panel/);
  assert.match(all(r.container, '[data-slot="accordion-body"]')[0]!.className, /accordion__body/);
  assert.ok(r.container.querySelector(".accordion__body-inner"));
  assert.equal(all(r.container, '[data-slot="accordion-indicator"]')[0]!.tagName.toLowerCase(), "svg");
  r.unmount();
});

test("exposes variant BEM modifier", () => {
  const r = renderAccordion({ variant: "surface" });
  assert.match(r.container.querySelector('[data-testid="accordion"]')!.className, /accordion--surface/);
  r.unmount();
});

test("supports expanding a panel via its trigger", async () => {
  const r = renderAccordion();
  const trigger = button(r.container, "How do I place an order?");
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  assert.equal(visible(trigger), false);
  trigger.click();
  await flush();
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  assert.equal(visible(trigger), true);
  assert.equal(panelOf(trigger).getAttribute("data-expanded"), "true");
  r.unmount();
});

test("supports single expanded item by default", async () => {
  const r = renderAccordion();
  const first = button(r.container, "How do I place an order?");
  const second = button(r.container, "Can I modify my order?");
  first.click();
  await flush();
  assert.equal(first.getAttribute("aria-expanded"), "true");
  second.click();
  await flush();
  assert.equal(second.getAttribute("aria-expanded"), "true");
  assert.equal(first.getAttribute("aria-expanded"), "false");
  r.unmount();
});

test("supports multiple expanded items with allowsMultipleExpanded", async () => {
  const r = renderAccordion({ allowsMultipleExpanded: true });
  const first = button(r.container, "How do I place an order?");
  const second = button(r.container, "Can I modify my order?");
  first.click();
  await flush();
  second.click();
  await flush();
  assert.equal(first.getAttribute("aria-expanded"), "true");
  assert.equal(second.getAttribute("aria-expanded"), "true");
  r.unmount();
});

test("calls onExpandedChange with the expanded keys", async () => {
  const calls: Set<unknown>[] = [];
  const r = renderAccordion({ onExpandedChange: (k: Set<unknown>) => calls.push(k) });
  button(r.container, "How do I place an order?").click();
  await flush();
  assert.deepEqual(calls, [new Set(["faq-1"])]);
  r.unmount();
});

test("supports disabled items without expanding", async () => {
  const r = renderAccordion();
  const disabled = button(r.container, "Disabled question");
  assert.equal(disabled.disabled, true);
  disabled.click();
  await flush();
  assert.equal(disabled.getAttribute("aria-expanded"), "false");
  assert.equal(visible(disabled), false);
  r.unmount();
});

test("exposes data-expanded on the indicator", async () => {
  const r = renderAccordion();
  const indicator = r.container.querySelector('[data-slot="accordion-indicator"]')!;
  assert.equal(indicator.hasAttribute("data-expanded"), false);
  button(r.container, "How do I place an order?").click();
  await flush();
  assert.equal(indicator.getAttribute("data-expanded"), "true");
  r.unmount();
});

test("exposes data-hide-separator when hideSeparator is set", () => {
  const r = renderAccordion({ hideSeparator: true });
  for (const item of all(r.container, '[data-slot="accordion-item"]')) assert.equal(item.getAttribute("data-hide-separator"), "true");
  r.unmount();
  const r2 = renderAccordion();
  for (const item of all(r2.container, '[data-slot="accordion-item"]')) assert.equal(item.hasAttribute("data-hide-separator"), false);
  r2.unmount();
});

test("Rivet: a two-way expandedKeys signal follows the triggers and drives them", async () => {
  const keys = signal(new Set<string | number>(["faq-2"]));
  const r = renderAccordion({ expandedKeys: keys });
  assert.equal(button(r.container, "Can I modify my order?").getAttribute("aria-expanded"), "true");
  button(r.container, "How do I place an order?").click();
  await flush();
  assert.deepEqual(keys(), new Set(["faq-1"]));
  keys.set(new Set());
  await flush();
  assert.equal(button(r.container, "How do I place an order?").getAttribute("aria-expanded"), "false");
  r.unmount();
});

test("Rivet: custom indicator children render inside a span with the indicator class + state", async () => {
  const r = render(() => (
    <Accordion>
      <Accordion.Item id="a">
        <Accordion.Heading>
          <Accordion.Trigger>
            Item
            <Accordion.Indicator class="extra">
              <i id="custom" />
            </Accordion.Indicator>
          </Accordion.Trigger>
        </Accordion.Heading>
        <Accordion.Panel>
          <Accordion.Body>Body</Accordion.Body>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  ));
  const span = r.container.querySelector('[data-slot="accordion-indicator"]')!;
  assert.equal(span.tagName.toLowerCase(), "span");
  assert.match(span.className, /accordion__indicator/);
  assert.match(span.className, /extra/);
  assert.ok(span.querySelector("#custom"));
  (r.container.querySelector('[data-slot="accordion-trigger"]') as HTMLElement).click();
  await flush();
  assert.equal(span.getAttribute("data-expanded"), "true");
  r.unmount();
});

test("Rivet: SurfaceContext = default for the surface variant, the outer surface otherwise", () => {
  const seen: unknown[] = [];
  const Probe = () => {
    seen.push(useContext(SurfaceContext).variant);
    return <span />;
  };
  const r = render(() => (
    <>
      <Accordion variant="surface">
        <Probe />
      </Accordion>
      <Accordion>
        <Probe />
      </Accordion>
    </>
  ));
  assert.deepEqual(seen, ["default", undefined]);
  r.unmount();
});

test("Rivet: a live variant updates the root class", async () => {
  const variant = signal<"default" | "surface">("default");
  const r = render(() => (
    <Accordion data-testid="acc" variant={variant()}>
      <Items />
    </Accordion>
  ));
  const root = r.container.querySelector('[data-testid="acc"]')!;
  assert.doesNotMatch(root.className, /accordion--surface/);
  variant.set("surface");
  await flush();
  assert.match(root.className, /accordion--surface/);
  r.unmount();
});

test("Rivet: parts outside an Accordion get only the caller's class", () => {
  const r = render(() => <ui.AccordionBody class="mine">x</ui.AccordionBody>);
  const body = r.container.querySelector('[data-slot="accordion-body"]')!;
  assert.equal(body.getAttribute("class") ?? "", "");
  assert.equal(body.firstElementChild!.className, "mine");
  r.unmount();
});

test("Rivet: index exports the compound parts, named parts and variants", () => {
  assert.equal(Accordion.Root, ui.AccordionRoot);
  assert.equal(Accordion.Item, ui.AccordionItem);
  assert.equal(Accordion.Heading, ui.AccordionHeading);
  assert.equal(Accordion.Trigger, ui.AccordionTrigger);
  assert.equal(Accordion.Panel, ui.AccordionPanel);
  assert.equal(Accordion.Indicator, ui.AccordionIndicator);
  assert.equal(Accordion.Body, ui.AccordionBody);
  assert.equal(typeof ui.accordionVariants, "function");
});
