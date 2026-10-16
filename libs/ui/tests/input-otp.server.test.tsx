// Server-target suite: `InputOTP` SSR markup (upstream input-otp `ssr` case + classes, vendored container / input markup).
import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { InputOTP, inputOTPVariants } from "../src/components/input-otp/index.ts";
import { assertSameHtml } from "./same-html.ts";

test("upstream SSR: renders grouped slots without errors", async () => {
  const html = await renderToString(() => (
    <InputOTP maxLength={6}>
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
  assert.match(html, /data-slot="input-otp"/);
  assert.match(html, /data-slot="input-otp-slot"/);
  assert.equal(html.match(/data-slot="input-otp-slot"/g)!.length, 6);
  const slots = inputOTPVariants({});
  assert.match(html, new RegExp(`class="${slots.base()}"`));
  assert.match(html, /data-input-otp-container="true"/);
  assert.match(html, /translate="no"/);
  assert.doesNotMatch(html, /<noscript>/); // no inline <style> in Rivet JSX (known diff)
  assert.match(html, /<input[^>]*autocomplete="one-time-code"/);
  assert.match(html, /<input[^>]*maxlength="6"/);
  assert.match(html, /<input[^>]*inputmode="numeric"/);
  assert.match(html, /<input[^>]*data-input-otp="true"/);
});

test("SSR: value fills the slots; invalid / disabled data attributes; secondary variant", async () => {
  const html = await renderToString(() => (
    <InputOTP isDisabled isInvalid maxLength={3} value="12" variant="secondary">
      <InputOTP.Group>
        <InputOTP.Slot index={0} />
        <InputOTP.Slot index={1} />
        <InputOTP.Slot index={2} />
      </InputOTP.Group>
    </InputOTP>
  ));
  assert.match(html, new RegExp(`class="${inputOTPVariants({ variant: "secondary" }).base()}"`));
  assert.equal(html.match(/data-filled="true"/g)!.length, 2);
  assert.match(html, /data-slot="input-otp-slot-value"[^>]*>1</);
  assert.match(html, /<input[^>]*disabled/);
  assert.match(html, /<input[^>]*data-invalid="true"/);
  assert.equal(html.match(/data-disabled="true"/g)!.length, 4); // input + 3 slots
});

test("shorthand SSR (T21): InputOTP without children = one Group with a Slot per maxLength position", async () => {
  await assertSameHtml(
    () => <InputOTP maxLength={4} />,
    () => (
      <InputOTP maxLength={4}>
        <InputOTP.Group>
          <InputOTP.Slot index={0} />
          <InputOTP.Slot index={1} />
          <InputOTP.Slot index={2} />
          <InputOTP.Slot index={3} />
        </InputOTP.Group>
      </InputOTP>
    ),
  );
});
