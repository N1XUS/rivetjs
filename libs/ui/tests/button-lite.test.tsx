// DOM-target suite: PRESS-LITE twin (`button-lite.tsx`, rendered by the build at proven `onPress` sites,
// `libs/compiler/native-lite.ts`). Same classes / data-slot / disabled attributes as the cdk path, `$cls` wins over the
// resolver, live `isDisabled` (getter, value or accessor) drives native `disabled`, a click calls `onPress`, a disabled
// button's click does not, and the element carries no press-state attributes.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const { Button, buttonVariants } = await import("../src/components/button/index.ts");
const { ButtonLite } = await import("../src/components/button/button-lite.tsx");

test("button lite: same classes and data attributes as the cdk Button for constant style props", () => {
  for (const props of [{}, { variant: "ghost" as const }, { size: "sm" as const, fullWidth: true }, { variant: "danger" as const, isIconOnly: true }]) {
    const lite = render(() => <ButtonLite {...props}>x</ButtonLite>);
    const cdk = render(() => <Button {...props}>x</Button>);
    const a = lite.container.firstElementChild!,
      b = cdk.container.firstElementChild!;
    assert.equal(a.tagName, "BUTTON");
    assert.equal(a.className, b.className, JSON.stringify(props));
    assert.equal(a.className, buttonVariants(props));
    assert.equal(a.getAttribute("data-slot"), "button");
    assert.equal(a.getAttribute("type"), "button");
    lite.unmount();
    cdk.unmount();
  }
  const r = render(() => (
    <ButtonLite $cls="precomputed" variant="ghost" radius="concentric" aria-label="Add" data-x="1">
      +
    </ButtonLite>
  ));
  const el = r.container.firstElementChild!;
  assert.equal(el.className, "precomputed", "the build's class wins");
  assert.equal(el.getAttribute("data-radius"), "concentric");
  assert.equal(el.getAttribute("aria-label"), "Add");
  assert.equal(el.getAttribute("data-x"), "1");
  r.unmount();
});

test("button lite: click calls onPress; live isDisabled → native disabled + data-disabled, no press while disabled", () => {
  const count = signal(0);
  const off = signal(true);
  let calls = 0;
  const r = render(() => (
    <div>
      <ButtonLite id="inc" onPress={() => count.set(count() + 1)}>
        inc
      </ButtonLite>
      <ButtonLite id="reset" isDisabled={off()} onPress={() => (calls++, count.set(0))}>
        reset
      </ButtonLite>
      <ButtonLite id="acc" isDisabled={() => count() > 1}>
        acc
      </ButtonLite>
    </div>
  ));
  const inc = r.container.querySelector("#inc") as HTMLButtonElement;
  const reset = r.container.querySelector("#reset") as HTMLButtonElement;
  const acc = r.container.querySelector("#acc") as HTMLButtonElement;
  assert.equal(reset.disabled, true);
  assert.equal(reset.getAttribute("data-disabled"), "true");
  reset.click();
  assert.equal(calls, 0, "a disabled native button does not click");
  inc.click();
  inc.click();
  assert.equal(count(), 2);
  assert.equal(acc.disabled, true, "an accessor value is called");
  off.set(false);
  assert.equal(reset.disabled, false);
  assert.equal(reset.getAttribute("data-disabled"), null);
  reset.click();
  assert.equal(calls, 1);
  assert.equal(count(), 0);
  assert.equal(acc.disabled, false);
  for (const el of [inc, reset, acc])
    for (const attr of ["data-pressed", "data-hovered", "data-focus-visible", "data-focused"]) assert.equal(el.getAttribute(attr), null, attr);
  r.unmount();
});
