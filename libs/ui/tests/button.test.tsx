// DOM-target suite: `Button` (upstream button tests ported): classes per variant / size, data-slot, disabled + pending as accessors,
// ButtonGroupContext fallback (every Button under the provider; `BUTTON_GROUP_CHILD: false` opts out), `render` prop, ref.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { Provider } = await import("@rivetjs/runtime/dom");
const { signal } = await import("@rivetjs/reactivity");
const { Button, ButtonRoot, buttonVariants, BUTTON_GROUP_CHILD } = await import("../src/components/button/index.ts");
const { ButtonGroupContext } = await import("../src/components/button-group/button-group-context.ts");

test("button: markup, default variant / size, data-slot, type", () => {
  let el: Element | undefined;
  const r = render(() => (
    <Button class="mt-2" ref={(e: Element) => (el = e)}>
      Save
    </Button>
  ));
  const b = r.container.firstElementChild!;
  assert.equal(b, el);
  assert.equal(b.tagName, "BUTTON");
  assert.equal(b.getAttribute("data-slot"), "button");
  assert.equal(b.className, `${buttonVariants()} mt-2`);
  assert.match(b.className, /button--primary/);
  assert.match(b.className, /button--md/);
  assert.equal(b.textContent, "Save");
  r.unmount();
  assert.equal(Button, ButtonRoot);
});

test("button: variant / size / isIconOnly / fullWidth modifiers", () => {
  const r = render(() => (
    <Button variant="danger-soft" size="lg" isIconOnly fullWidth>
      x
    </Button>
  ));
  const cls = r.container.firstElementChild!.className;
  for (const m of ["button--danger-soft", "button--lg", "button--icon-only", "button--full-width"]) assert.match(cls, new RegExp(m));
  r.unmount();
});

test('button: brand variant + radius="concentric" (Rivet additions), radius live', () => {
  const radius = signal<"concentric" | undefined>("concentric");
  const r = render(() => (
    <Button variant="brand" radius={radius()}>
      go
    </Button>
  ));
  const b = r.container.firstElementChild!;
  assert.match(b.className, /\bbutton--brand\b/);
  assert.equal(b.getAttribute("data-radius"), "concentric");
  radius.set(undefined);
  assert.equal(r.container.firstElementChild, b);
  assert.equal(b.hasAttribute("data-radius"), false);
  r.unmount();
  const plain = render(() => <Button>go</Button>);
  assert.equal(plain.container.firstElementChild!.hasAttribute("data-radius"), false);
  plain.unmount();
});

test("button: isDisabled / isPending accessors follow signals without re-creating the node", () => {
  const dis = signal(false);
  const pend = signal(false);
  const r = render(() => (
    <Button isDisabled={() => dis()} isPending={() => pend()}>
      go
    </Button>
  ));
  const b = r.container.firstElementChild!;
  assert.equal(b.hasAttribute("disabled"), false);
  dis.set(true);
  assert.equal(r.container.firstElementChild, b);
  assert.equal(b.hasAttribute("disabled"), true);
  assert.equal(b.getAttribute("data-disabled"), "true");
  pend.set(true);
  assert.equal(b.getAttribute("data-pending"), "true");
  pend.set(false);
  assert.equal(b.hasAttribute("data-pending"), false);
  r.unmount();
});

test("button: function class + function children with render props", () => {
  const r = render(() => (
    <Button class={({ isDisabled }: { isDisabled: () => boolean }) => (isDisabled() ? "is-off" : "is-on")}>
      {({ isPending }: { isPending: () => boolean }) => (isPending() ? "busy" : "idle")}
    </Button>
  ));
  const b = r.container.firstElementChild!;
  assert.match(b.className, /is-on/);
  assert.match(b.className, /button--primary/);
  assert.equal(b.textContent, "idle");
  r.unmount();
});

test("button: ButtonGroupContext is used by every Button unless BUTTON_GROUP_CHILD is false; own props win", () => {
  const r = render(() => (
    <Provider token={ButtonGroupContext} value={{ size: "lg", variant: "secondary", isDisabled: true, fullWidth: true }}>
      {() => (
        <>
          <Button>child</Button>
          <Button {...{ [BUTTON_GROUP_CHILD]: false }}>outsider</Button>
          <Button size="sm" variant="ghost" isDisabled={false}>
            own
          </Button>
        </>
      )}
    </Provider>
  ));
  const [child, outsider, own] = Array.from(r.container.querySelectorAll("button"));
  assert.match(child.className, /button--lg/);
  assert.match(child.className, /button--secondary/);
  assert.match(child.className, /button--full-width/);
  assert.equal(child.hasAttribute("disabled"), true);
  assert.match(outsider.className, /button--md.*button--primary|button--primary.*button--md/);
  assert.equal(outsider.hasAttribute("disabled"), false);
  assert.match(own.className, /button--sm/);
  assert.match(own.className, /button--ghost/);
  assert.equal(own.hasAttribute("disabled"), false);
  r.unmount();
});

test("button: render prop swaps the element, keeps classes + data-slot, forwards ref", () => {
  let el: Element | undefined;
  const r = render(() => (
    <Button render={(props) => <a {...(props as {})} href="#x" />} ref={(e: Element) => (el = e)}>
      link
    </Button>
  ));
  const a = r.container.firstElementChild!;
  assert.equal(a.tagName, "A");
  assert.equal(a.getAttribute("href"), "#x");
  assert.equal(a.getAttribute("data-slot"), "button");
  assert.match(a.className, /button--primary/);
  assert.equal(el, a);
  r.unmount();
});
