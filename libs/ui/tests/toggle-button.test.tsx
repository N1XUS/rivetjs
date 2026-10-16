// DOM-target suite: `ToggleButton` (upstream toggle-button tests ported where happy-dom suffices; hover / press / focus-visible /
// keyboard run in Chromium: `tests-components/toggle-button.test.ts`): role + name, BEM block + data-slot + aria-pressed, data
// passthrough, toggling via click, defaultSelected, controlled `isSelected` (two-way signal: external set and press), disabled blocks
// toggling; Rivet: group `size` from `ToggleButtonGroupContext`, live `variant` / `size` keep the node, index exports.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Provider } = await import("@rivetjs/runtime/dom");
const { signal } = await import("@rivetjs/reactivity");
const { ToggleButton, ToggleButtonRoot, toggleButtonVariants } = await import("../src/components/toggle-button/index.ts");
const { ToggleButtonGroupContext } = await import("../src/components/toggle-button-group/toggle-button-group-context.ts");

const flush = () => new Promise((r) => setTimeout(r, 0));

test("toggle-button: role + accessible name, BEM block, data-slot, aria-pressed", () => {
  const r = render(() => <ToggleButton>Bold</ToggleButton>);
  const b = r.container.firstElementChild!;
  assert.equal(b.tagName, "BUTTON");
  assert.equal(b.textContent, "Bold");
  assert.equal(b.className, toggleButtonVariants());
  assert.match(b.className, /toggle-button/);
  assert.equal(b.getAttribute("data-slot"), "toggle-button");
  assert.equal(b.getAttribute("aria-pressed"), "false");
  assert.equal(ToggleButton, ToggleButtonRoot);
  assert.equal(ToggleButton.Root, ToggleButtonRoot);
  r.unmount();
});

test("toggle-button: data attribute passthrough, class composes after the variants", () => {
  const r = render(() => (
    <ToggleButton data-testid="toggle" class="mt-1" variant="ghost" size="sm" isIconOnly>
      B
    </ToggleButton>
  ));
  const b = r.container.firstElementChild!;
  assert.equal(b.getAttribute("data-testid"), "toggle");
  assert.equal(b.className, `${toggleButtonVariants({ variant: "ghost", size: "sm", isIconOnly: true })} mt-1`);
  r.unmount();
});

test("toggle-button: click toggles aria-pressed / data-selected and calls onChange", async () => {
  const calls: boolean[] = [];
  const r = render(() => <ToggleButton onChange={(v: boolean) => calls.push(v)}>Bold</ToggleButton>);
  const b = r.container.firstElementChild as HTMLButtonElement;
  b.click();
  await flush();
  assert.equal(b.getAttribute("aria-pressed"), "true");
  assert.equal(b.getAttribute("data-selected"), "true");
  b.click();
  await flush();
  assert.equal(b.getAttribute("aria-pressed"), "false");
  assert.deepEqual(calls, [true, false]);
  r.unmount();
});

test("toggle-button: uncontrolled defaultSelected", () => {
  const r = render(() => <ToggleButton defaultSelected>Bold</ToggleButton>);
  assert.equal(r.container.firstElementChild!.getAttribute("aria-pressed"), "true");
  r.unmount();
});

test("toggle-button: controlled isSelected both ways (external set → DOM, press → signal), same node", async () => {
  const selected = signal(false);
  const r = render(() => <ToggleButton isSelected={selected}>Bold</ToggleButton>);
  const b = r.container.firstElementChild as HTMLButtonElement;
  assert.equal(b.getAttribute("aria-pressed"), "false");
  selected.set(true);
  await flush();
  assert.equal(b.getAttribute("aria-pressed"), "true");
  b.click();
  await flush();
  assert.equal(selected(), false);
  assert.equal(b.getAttribute("aria-pressed"), "false");
  assert.equal(r.container.firstElementChild, b);
  r.unmount();
});

test("toggle-button: disabled state blocks toggling", async () => {
  const calls: boolean[] = [];
  const r = render(() => (
    <ToggleButton isDisabled onChange={(v: boolean) => calls.push(v)}>
      Bold
    </ToggleButton>
  ));
  const b = r.container.firstElementChild as HTMLButtonElement;
  assert.equal(b.hasAttribute("disabled"), true);
  assert.equal(b.getAttribute("data-disabled"), "true");
  b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await flush();
  assert.deepEqual(calls, []);
  assert.equal(b.getAttribute("aria-pressed"), "false");
  r.unmount();
});

test("toggle-button: size from ToggleButtonGroupContext; own size wins", () => {
  const r = render(() => (
    <Provider token={ToggleButtonGroupContext} value={{ size: "lg" }}>
      {() => (
        <>
          <ToggleButton>a</ToggleButton>
          <ToggleButton size="sm">b</ToggleButton>
        </>
      )}
    </Provider>
  ));
  const [a, b] = Array.from(r.container.querySelectorAll("button"));
  assert.match(a!.className, /toggle-button--lg/);
  assert.match(b!.className, /toggle-button--sm/);
  assert.doesNotMatch(b!.className, /toggle-button--lg/);
  r.unmount();
});

test("toggle-button: live variant / size / group size restyle the same node", () => {
  const variant = signal<"default" | "ghost">("default");
  const size = signal<"sm" | "md" | "lg" | undefined>(undefined);
  const groupSize = signal<"sm" | "md" | "lg">("sm");
  const ctx = {
    get size() {
      return groupSize();
    },
  };
  const r = render(() => (
    <Provider token={ToggleButtonGroupContext} value={ctx}>
      {() => (
        <ToggleButton variant={variant()} size={size()}>
          x
        </ToggleButton>
      )}
    </Provider>
  ));
  const b = r.container.firstElementChild!;
  assert.match(b.className, /toggle-button--sm/);
  variant.set("ghost");
  assert.equal(r.container.firstElementChild, b);
  assert.match(b.className, /toggle-button--ghost/);
  groupSize.set("md");
  assert.match(b.className, /toggle-button--md/);
  size.set("lg");
  assert.match(b.className, /toggle-button--lg/);
  variant.set("default");
  assert.doesNotMatch(b.className, /toggle-button--ghost/);
  assert.equal(r.container.firstElementChild, b);
  r.unmount();
});
