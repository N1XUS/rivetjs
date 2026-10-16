// DOM-target suite: `NumberStepper` (Rivet addition; feature set inspired by HeroUI Pro's public docs, independent
// implementation) on happy-dom: compound statics + variants, presses step the value (two-way signal + onChange), bounds disable
// the buttons, a signal write updates the display (changed characters are new `data-roll` spans, unchanged ones stay),
// `format`, live size. Typing / keyboard / focus-visible run in Chromium (tests-components `pro-forms.test.ts`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const mod = await import("../src/components/number-stepper/index.ts");
const {
  NumberStepper,
  NumberStepperRoot,
  NumberStepperGroup,
  NumberStepperValue,
  NumberStepperDecrementButton,
  NumberStepperIncrementButton,
  numberStepperVariants,
} = mod;

const flush = () => new Promise((r) => setTimeout(r, 0));
const chars = (root: ParentNode) => Array.from(root.querySelectorAll("[data-slot=number-stepper-char]"));
const text = (root: ParentNode) =>
  chars(root)
    .map((c) => c.textContent)
    .join("");

test("number-stepper: compound statics + variants", () => {
  assert.equal(NumberStepper, NumberStepperRoot);
  assert.equal(NumberStepper.Root, NumberStepperRoot);
  assert.equal(NumberStepper.Group, NumberStepperGroup);
  assert.equal(NumberStepper.Value, NumberStepperValue);
  assert.equal(NumberStepper.DecrementButton, NumberStepperDecrementButton);
  assert.equal(NumberStepper.IncrementButton, NumberStepperIncrementButton);
  assert.equal(numberStepperVariants().base(), "number-stepper number-stepper--md");
  assert.equal(numberStepperVariants({ size: "sm" }).incrementButton(), "number-stepper__button number-stepper__increment-button");
});

test("number-stepper: presses step the value, bounds disable buttons, signal writes update the display", async () => {
  const value = signal<number | null>(9);
  const calls: number[] = [];
  const r = render(() => (
    <NumberStepper aria-label="Count" value={value} minValue={0} maxValue={10} onChange={(v: number) => calls.push(v)}>
      <NumberStepper.Group>
        <NumberStepper.DecrementButton />
        <NumberStepper.Value />
        <NumberStepper.IncrementButton />
      </NumberStepper.Group>
    </NumberStepper>
  ));
  const inc = r.container.querySelector<HTMLButtonElement>("[data-slot=number-stepper-increment-button]")!;
  const dec = r.container.querySelector<HTMLButtonElement>("[data-slot=number-stepper-decrement-button]")!;
  assert.equal(text(r.container), "9");
  inc.click();
  await flush();
  assert.equal(value(), 10);
  assert.deepEqual(calls, [10]);
  assert.equal(text(r.container), "10");
  assert.equal(inc.disabled, true);
  value.set(5);
  await flush();
  assert.equal(text(r.container), "5");
  assert.equal(inc.disabled, false);
  dec.click();
  await flush();
  assert.equal(value(), 4);
  // A changed character is a new span created on the client (`data-roll`).
  assert.equal(chars(r.container)[0]!.getAttribute("data-roll"), "true");
  r.unmount();
});

test("number-stepper: unchanged characters keep their span", async () => {
  const value = signal<number | null>(120);
  const r = render(() => (
    <NumberStepper aria-label="Count" value={value}>
      <NumberStepper.Group>
        <NumberStepper.Value />
      </NumberStepper.Group>
    </NumberStepper>
  ));
  const before = chars(r.container);
  value.set(125);
  await flush();
  const after = chars(r.container);
  assert.equal(text(r.container), "125");
  assert.equal(after[0], before[0]);
  assert.equal(after[1], before[1]);
  assert.notEqual(after[2], before[2]);
  r.unmount();
});

test("number-stepper: format + live size", async () => {
  const size = signal<"sm" | "md" | "lg">("sm");
  const r = render(() => (
    <NumberStepper aria-label="Nights" defaultValue={2} size={size()}>
      <NumberStepper.Group>
        <NumberStepper.Value format={(v) => `${v} nights`} />
      </NumberStepper.Group>
    </NumberStepper>
  ));
  assert.equal(text(r.container), "2 nights");
  const root = r.container.querySelector("[data-slot=number-stepper]")!;
  assert.match(root.className, /--sm/);
  size.set("lg");
  await flush();
  assert.match(root.className, /--lg/);
  r.unmount();
});
