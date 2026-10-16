// DOM-target suite: `InputOTP` (upstream input-otp tests ported) + the vendored input-otp 1.5.0 port (`src/vendor/input-otp`).
// Typing = `value` + an `input` event (happy-dom; upstream user-event); a real paste, the selection mirror and the fake caret
// run in Chromium (`tests-components/input-otp.test.ts`).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom(); // + FocusEvent, getComputedStyle (password-manager badge space check)

const { render, flush } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const mod = await import("../src/components/input-otp/index.ts");
const { InputOTP, InputOTPRoot, inputOTPVariants, REGEXP_ONLY_DIGITS, REGEXP_ONLY_CHARS, REGEXP_ONLY_DIGITS_AND_CHARS } = mod;
const { FieldError } = await import("../src/components/field-error/index.ts");

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const input = (root: ParentNode) => root.querySelector('[data-slot="input-otp"]') as HTMLInputElement;
const type = (el: HTMLInputElement, text: string) => {
  el.focus();
  for (const ch of text) {
    el.value += ch;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
};

const renderOtp = (props: Record<string, unknown> = {}) =>
  render(() => (
    <InputOTP maxLength={6} {...props}>
      <InputOTP.Group>
        <InputOTP.Slot index={0} />
        <InputOTP.Slot index={1} />
        <InputOTP.Slot index={2} />
      </InputOTP.Group>
      <InputOTP.Separator />
      <InputOTP.Group>
        <InputOTP.Slot index={3} />
        <InputOTP.Slot index={4} />
        <InputOTP.Slot index={5} />
      </InputOTP.Group>
    </InputOTP>
  ));

test("index: compound parts, named exports, variants, regexp constants (upstream index.ts)", () => {
  assert.equal(InputOTP, InputOTPRoot);
  assert.equal(InputOTP.Root, InputOTPRoot);
  for (const k of ["Group", "Slot", "Separator"] as const) assert.equal(typeof InputOTP[k], "function");
  assert.equal(typeof inputOTPVariants, "function");
  assert.equal(REGEXP_ONLY_DIGITS, "^\\d+$");
  assert.equal(REGEXP_ONLY_CHARS, "^[a-zA-Z]+$");
  assert.equal(REGEXP_ONLY_DIGITS_AND_CHARS, "^[a-zA-Z0-9]+$");
});

test("upstream: exposes root and compound data-slots", () => {
  const r = renderOtp();
  assert.ok(input(r.container));
  assert.equal(r.container.querySelectorAll('[data-slot="input-otp-group"]').length, 2);
  assert.equal(r.container.querySelectorAll('[data-slot="input-otp-slot"]').length, 6);
  assert.ok(r.container.querySelector('[data-slot="input-otp-separator"]'));
  r.unmount();
});

test("upstream: exposes BEM block on the container; input + parts carry their slot classes", () => {
  const r = renderOtp();
  const container = r.container.querySelector('[data-input-otp-container="true"]')!;
  assert.ok(container, "container data attribute");
  assert.match(container.className, /\binput-otp\b/);
  const slots = inputOTPVariants({});
  assert.equal(container.className, slots.base());
  assert.equal(input(r.container).className, slots.input());
  assert.equal(r.container.querySelector('[data-slot="input-otp-group"]')!.className, slots.group());
  assert.equal(r.container.querySelector('[data-slot="input-otp-slot"]')!.className, slots.slot());
  assert.equal(r.container.querySelector('[data-slot="input-otp-separator"]')!.className, slots.separator());
  assert.equal(container.getAttribute("translate"), "no");
  r.unmount();
});

test("vendor: input attributes (autocomplete, inputmode, maxlength, spellcheck, pattern, aria-placeholder, data-input-otp)", () => {
  const r = renderOtp({ pattern: REGEXP_ONLY_DIGITS, placeholder: "000000", name: "code" });
  const el = input(r.container);
  assert.equal(el.getAttribute("autocomplete"), "one-time-code");
  assert.equal(el.getAttribute("inputmode"), "numeric");
  assert.equal(el.maxLength, 6);
  assert.equal(el.getAttribute("spellcheck"), "false");
  assert.equal(el.getAttribute("pattern"), "^\\d+$");
  assert.equal(el.getAttribute("aria-placeholder"), "000000");
  assert.equal(el.getAttribute("name"), "code");
  assert.equal(el.getAttribute("data-input-otp"), "true");
  assert.equal(el.getAttribute("data-input-otp-placeholder-shown"), "true");
  r.unmount();
});

test("upstream: calls onChange while typing digits", async () => {
  const calls: string[] = [];
  const r = renderOtp({ onChange: (v: string) => calls.push(v) });
  type(input(r.container), "12");
  await flush();
  assert.ok(calls.length > 0);
  assert.equal(calls.at(-1), "12");
  assert.equal(r.container.querySelectorAll('[data-filled="true"]').length, 2);
  assert.equal(r.container.querySelector('[data-slot="input-otp-slot-value"]')!.textContent, "1");
  assert.equal(input(r.container).hasAttribute("data-input-otp-placeholder-shown"), false);
  r.unmount();
});

test("typing keeps the earlier slots' value nodes (their roll-in does not replay)", async () => {
  const r = renderOtp();
  const el = input(r.container);
  const values = () => [...r.container.querySelectorAll('[data-slot="input-otp-slot-value"]')];
  type(el, "1");
  await flush();
  const [first] = values();
  type(el, "2");
  await flush();
  // Booleans: a failing assert on happy-dom nodes inspects their whole object graph (GBs).
  assert.ok(values()[0] === first, "slot 0 value kept after the second digit");
  const second = values()[1];
  type(el, "3");
  await flush();
  assert.ok(values()[0] === first && values()[1] === second, "slots 0 + 1 values kept after the third digit");
  assert.deepEqual(
    values().map((v) => v.textContent),
    ["1", "2", "3"],
  );
  r.unmount();
});

test("upstream: calls onComplete when maxLength is reached", async () => {
  const done: string[] = [];
  const r = renderOtp({ maxLength: 4, onComplete: (v: string) => done.push(v) });
  type(input(r.container), "123");
  await flush();
  assert.deepEqual(done, []);
  type(input(r.container), "4");
  await flush();
  assert.deepEqual(done, ["1234"]);
  r.unmount();
});

test("upstream: supports disabled state", async () => {
  const calls: string[] = [];
  const r = renderOtp({ isDisabled: true, onChange: (v: string) => calls.push(v) });
  const el = input(r.container);
  assert.equal(el.disabled, true);
  assert.equal(el.getAttribute("data-disabled"), "true");
  for (const s of r.container.querySelectorAll('[data-slot="input-otp-slot"]')) assert.equal(s.getAttribute("data-disabled"), "true");
  assert.equal((r.container.querySelector("[data-input-otp-container]") as HTMLElement).style.cursor, "default");
  // A disabled input receives no input events from the user (upstream user-event types nothing).
  await wait(60);
  assert.deepEqual(calls, []);
  r.unmount();
});

test("upstream: supports invalid state with FieldError", async () => {
  const r = render(() => (
    <InputOTP isInvalid maxLength={6} validationErrors={["Invalid code"]}>
      <InputOTP.Group>
        <InputOTP.Slot index={0} />
        <InputOTP.Slot index={1} />
        <InputOTP.Slot index={2} />
      </InputOTP.Group>
      <FieldError>Invalid code</FieldError>
    </InputOTP>
  ));
  await flush();
  assert.equal(input(r.container).getAttribute("data-invalid"), "true");
  assert.equal(r.container.querySelector('[data-slot="input-otp-slot"]')!.getAttribute("data-invalid"), "true");
  const error = r.container.querySelector('[data-slot="field-error"]');
  assert.ok(error, "FieldError renders under an invalid InputOTP");
  assert.equal(error!.textContent, "Invalid code");
  r.unmount();
});

test("upstream: supports filling slots from paste (pasteTransformer path; native paste in Chromium)", async () => {
  const calls: string[] = [];
  const r = renderOtp({ onChange: (v: string) => calls.push(v), pasteTransformer: (s: string) => s.replace(/-/g, "") });
  const el = input(r.container);
  el.focus();
  const event = new Event("paste", { bubbles: true, cancelable: true }) as Event & { clipboardData: unknown };
  event.clipboardData = { getData: () => "654-321" };
  el.dispatchEvent(event);
  await flush();
  assert.equal(event.defaultPrevented, true);
  assert.equal(calls.at(-1), "654321");
  assert.equal(r.container.querySelectorAll('[data-filled="true"]').length, 6);
  r.unmount();
});

test("vendor: pattern rejects a non-matching value (input keeps the previous value)", async () => {
  const calls: string[] = [];
  const r = renderOtp({ pattern: REGEXP_ONLY_DIGITS, onChange: (v: string) => calls.push(v) });
  const el = input(r.container);
  type(el, "1a");
  await flush();
  assert.deepEqual(calls, ["1"]);
  assert.equal(el.value, "1");
  r.unmount();
});

test("vendor: two-way Signal value + live string value", async () => {
  const code = signal("12");
  const r = renderOtp({ value: code });
  const el = input(r.container);
  assert.equal(el.value, "12");
  assert.equal(r.container.querySelectorAll('[data-filled="true"]').length, 2);
  type(el, "3");
  await flush();
  assert.equal(code(), "123");
  code.set("");
  await flush();
  assert.equal(el.value, "");
  assert.equal(r.container.querySelectorAll('[data-filled="true"]').length, 0);
  r.unmount();

  // Controlled string: an owner that ignores onChange keeps the shown value.
  const fixed = signal("9");
  const r2 = render(() => (
    <InputOTP maxLength={4} value={fixed()}>
      <InputOTP.Group>
        <InputOTP.Slot index={0} />
        <InputOTP.Slot index={1} />
      </InputOTP.Group>
    </InputOTP>
  ));
  const el2 = input(r2.container);
  type(el2, "8");
  await flush();
  assert.equal(el2.value, "9");
  fixed.set("98");
  await flush();
  assert.equal(el2.value, "98");
  assert.equal(r2.container.querySelectorAll('[data-filled="true"]').length, 2);
  r2.unmount();
});

test("vendor: focus marks the active slot + fake caret; blur clears it", async () => {
  const r = renderOtp();
  const el = input(r.container);
  el.dispatchEvent(new FocusEvent("focus"));
  el.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
  await flush();
  const first = r.container.querySelector('[data-slot="input-otp-slot"]')!;
  assert.equal(first.getAttribute("data-active"), "true");
  assert.ok(first.querySelector('[data-slot="input-otp-caret"]'), "fake caret in the empty active slot");
  el.dispatchEvent(new FocusEvent("blur"));
  el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  await flush();
  assert.equal(first.hasAttribute("data-active"), false);
  r.unmount();
});

test("variant + class / inputClass; live variant updates in place", async () => {
  const variant = signal<"primary" | "secondary">("secondary");
  const r = render(() => (
    <InputOTP class="my-otp" inputClass="my-input" maxLength={2} variant={variant()}>
      <InputOTP.Group>
        <InputOTP.Slot class="my-slot" index={0} />
        <InputOTP.Slot index={1} />
      </InputOTP.Group>
    </InputOTP>
  ));
  const container = r.container.querySelector("[data-input-otp-container]")!;
  assert.equal(container.className, inputOTPVariants({ variant: "secondary" }).base({ className: "my-otp" }));
  assert.equal(input(r.container).className, inputOTPVariants({}).input({ className: "my-input" }));
  assert.match(r.container.querySelector('[data-slot="input-otp-slot"]')!.className, /\binput-otp__slot\b.*\bmy-slot\b/);
  variant.set("primary");
  await flush();
  assert.equal(r.container.querySelector("[data-input-otp-container]"), container, "container kept");
  assert.equal(container.className, inputOTPVariants({ variant: "primary" }).base({ className: "my-otp" }));
  r.unmount();
});

test("parts outside an InputOTP render without slot classes", () => {
  const r = render(() => (
    <div>
      <InputOTP.Group class="g" />
      <InputOTP.Separator />
    </div>
  ));
  assert.equal(r.container.querySelector('[data-slot="input-otp-group"]')!.className, "g");
  assert.equal(r.container.querySelector('[data-slot="input-otp-separator"]')!.getAttribute("class") ?? "", "");
  r.unmount();
});
