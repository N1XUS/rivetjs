// DOM-target suite: `Disclosure` (upstream tests/components/disclosure/disclosure.test.tsx ported to happy-dom): data-slot + BEM
// block + compound part slots; expanding via the trigger (aria-expanded, panel hidden ↔ visible); defaultExpanded; controlled
// isExpanded + onExpandedChange (stays collapsed); disabled trigger does not toggle; data-expanded on the indicator. Rivet:
// part classes (`disclosure__*`), data-expanded on Content, two-way `isExpanded` signal, custom indicator children (span
// wrapper), render-function children, parts outside a Disclosure (caller class only), index exports. Keyboard (Enter / Space)
// on a real browser: `tests-components/disclosure.test.ts`.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const ui = await import("../src/components/disclosure/index.ts");
const { Disclosure } = ui;

const flush = () => new Promise((r) => setTimeout(r, 20));

interface FixtureProps {
  defaultExpanded?: boolean;
  isExpanded?: boolean | ReturnType<typeof signal<boolean>>;
  isDisabled?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  indicator?: () => unknown;
}

const DisclosureFixture = (props: FixtureProps) => (
  <Disclosure
    data-testid="disclosure"
    defaultExpanded={props.defaultExpanded}
    isExpanded={props.isExpanded as never}
    isDisabled={props.isDisabled}
    onExpandedChange={props.onExpandedChange}
  >
    <Disclosure.Heading>
      <Disclosure.Trigger>
        Toggle content
        <Disclosure.Indicator />
      </Disclosure.Trigger>
    </Disclosure.Heading>
    <Disclosure.Content>
      <Disclosure.Body>Hidden content revealed on expand.</Disclosure.Body>
    </Disclosure.Content>
  </Disclosure>
);

const q = (root: ParentNode, sel: string) => root.querySelector(sel) as HTMLElement | null;
const trigger = (root: ParentNode) => q(root, '[data-slot="disclosure-trigger"]')!;
const panel = (root: ParentNode) => q(root, '[data-slot="disclosure-content"]')!;
const visible = (root: ParentNode) => !panel(root).hasAttribute("hidden");

test("exposes data-slot, BEM block, and compound part slots", () => {
  const r = render(() => <DisclosureFixture />);
  const root = q(r.container, '[data-testid="disclosure"]')!;
  assert.equal(root.getAttribute("data-slot"), "disclosure");
  assert.match(root.className, /\bdisclosure\b/);
  for (const s of ["disclosure-heading", "disclosure-trigger", "disclosure-content", "disclosure-indicator", "disclosure-body"])
    assert.ok(q(r.container, `[data-slot="${s}"]`), s);
  // Rivet: the part classes.
  assert.match(q(r.container, '[data-slot="disclosure-heading"]')!.className, /disclosure__heading/);
  assert.match(trigger(r.container).className, /disclosure__trigger/);
  assert.match(panel(r.container).className, /disclosure__content/);
  assert.match(q(r.container, '[data-slot="disclosure-body"]')!.className, /disclosure__body/);
  assert.equal(q(r.container, ".disclosure__body-inner")!.textContent, "Hidden content revealed on expand.");
  assert.match(q(r.container, '[data-slot="disclosure-indicator"]')!.getAttribute("class") ?? "", /disclosure__indicator/);
  assert.equal(q(r.container, '[data-slot="disclosure-indicator"]')!.tagName.toLowerCase(), "svg");
  r.unmount();
});

test("supports expanding via the trigger", async () => {
  const r = render(() => <DisclosureFixture />);
  assert.equal(trigger(r.container).getAttribute("aria-expanded"), "false");
  assert.equal(visible(r.container), false);
  trigger(r.container).click();
  await flush();
  assert.equal(trigger(r.container).getAttribute("aria-expanded"), "true");
  assert.equal(visible(r.container), true);
  assert.equal(panel(r.container).getAttribute("data-expanded"), "true");
  trigger(r.container).click();
  await flush();
  assert.equal(trigger(r.container).getAttribute("aria-expanded"), "false");
  assert.equal(visible(r.container), false);
  assert.equal(panel(r.container).hasAttribute("data-expanded"), false);
  r.unmount();
});

test("supports defaultExpanded", () => {
  const r = render(() => <DisclosureFixture defaultExpanded />);
  assert.equal(trigger(r.container).getAttribute("aria-expanded"), "true");
  assert.equal(visible(r.container), true);
  assert.equal(panel(r.container).getAttribute("data-expanded"), "true");
  r.unmount();
});

test("supports controlled isExpanded + onExpandedChange", async () => {
  const calls: boolean[] = [];
  const r = render(() => <DisclosureFixture isExpanded={false} onExpandedChange={(e) => calls.push(e)} />);
  trigger(r.container).click();
  await flush();
  assert.deepEqual(calls, [true]);
  assert.equal(visible(r.container), false);
  r.unmount();
});

test("Rivet: a two-way isExpanded signal follows the trigger and drives it", async () => {
  const open = signal(false);
  const r = render(() => <DisclosureFixture isExpanded={open} />);
  trigger(r.container).click();
  await flush();
  assert.equal(open(), true);
  assert.equal(visible(r.container), true);
  open.set(false);
  await flush();
  assert.equal(trigger(r.container).getAttribute("aria-expanded"), "false");
  r.unmount();
});

test("supports disabled state without toggling", async () => {
  const r = render(() => <DisclosureFixture isDisabled />);
  const t = trigger(r.container) as HTMLButtonElement;
  assert.equal(t.disabled, true);
  t.click();
  await flush();
  assert.equal(t.getAttribute("aria-expanded"), "false");
  r.unmount();
});

test("exposes data-expanded on the indicator", async () => {
  const r = render(() => <DisclosureFixture />);
  const indicator = q(r.container, '[data-slot="disclosure-indicator"]')!;
  assert.equal(indicator.hasAttribute("data-expanded"), false);
  trigger(r.container).click();
  await flush();
  assert.equal(indicator.getAttribute("data-expanded"), "true");
  r.unmount();
});

test("Rivet: custom indicator children render inside a span with the indicator class + state", async () => {
  const r = render(() => (
    <Disclosure>
      <Disclosure.Heading>
        <Disclosure.Trigger>
          Toggle
          <Disclosure.Indicator class="extra">
            <i>+</i>
          </Disclosure.Indicator>
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body>Body</Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  ));
  const indicator = q(r.container, '[data-slot="disclosure-indicator"]')!;
  assert.equal(indicator.tagName.toLowerCase(), "span");
  assert.match(indicator.className, /disclosure__indicator/);
  assert.match(indicator.className, /extra/);
  assert.equal(indicator.querySelector("i")!.textContent, "+");
  trigger(r.container).click();
  await flush();
  assert.equal(indicator.getAttribute("data-expanded"), "true");
  r.unmount();
});

test("Rivet: render-function children of the root and the trigger get the cdk render props", async () => {
  const r = render(() => (
    <Disclosure>
      {({ isExpanded }) => (
        <>
          <Disclosure.Heading>
            <Disclosure.Trigger>{({ isPressed }) => <span id="t">{isPressed() ? "pressed" : "idle"}</span>}</Disclosure.Trigger>
          </Disclosure.Heading>
          <span id="state">{isExpanded() ? "open" : "closed"}</span>
          <Disclosure.Content>
            <Disclosure.Body>Body</Disclosure.Body>
          </Disclosure.Content>
        </>
      )}
    </Disclosure>
  ));
  assert.equal(q(r.container, "#t")!.textContent, "idle");
  assert.equal(q(r.container, "#state")!.textContent, "closed");
  trigger(r.container).click();
  await flush();
  assert.equal(q(r.container, "#state")!.textContent, "open");
  r.unmount();
});

test("Rivet: parts outside a Disclosure get only the caller's class", () => {
  const r = render(() => <ui.DisclosureBody class="mine">x</ui.DisclosureBody>);
  const body = q(r.container, '[data-slot="disclosure-body"]')!;
  assert.equal(body.getAttribute("class"), null);
  assert.equal(body.firstElementChild!.getAttribute("class"), "mine");
  r.unmount();
});

test("Rivet: index exports the compound parts, named parts and variants", () => {
  assert.equal(Disclosure.Root, ui.DisclosureRoot);
  assert.equal(Disclosure.Heading, ui.DisclosureHeading);
  assert.equal(Disclosure.Trigger, ui.DisclosureTrigger);
  assert.equal(Disclosure.Content, ui.DisclosureContent);
  assert.equal(Disclosure.Body, ui.DisclosureBody);
  assert.equal(Disclosure.Indicator, ui.DisclosureIndicator);
  assert.equal(typeof ui.disclosureVariants, "function");
});
