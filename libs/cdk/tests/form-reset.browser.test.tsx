// Ported from react-aria test/utils/useFormReset.test.tsx (react-spectrum, Apache-2.0, © Adobe).
// Changes: plain DOM in Chromium (no React); `useFormReset(ref, '', onReset)` → `useFormReset(input, "", onReset)`
// from `utils` (call once the input is in its form) and the Rivet field helper `onFormReset(owner, input, fn)`
// (form/behaviour.ts, used by the cdk fields' validation reset) run through the same cases; React's `onReset` /
// `onResetCapture` props → `addEventListener("reset", …, capture?)` on the form.
// Skipped (as upstream): "should not call onReset if reset is cancelled".
import { describe, expect, it, vi } from "vitest";
import { useFormReset } from "../utils/index.ts";
import { onFormReset } from "../form/behaviour.ts";

type Attach = (input: HTMLInputElement, onReset: () => void) => void;

function setup(count: number, listener?: { capture: boolean; handler: (e: Event) => void }) {
  const form = document.createElement("form");
  const inputs = Array.from({ length: count }, () => {
    const input = document.createElement("input");
    input.type = "text";
    form.append(input);
    return input;
  });
  const button = document.createElement("button");
  button.type = "reset";
  button.textContent = "Reset";
  form.append(button);
  if (listener) form.addEventListener("reset", listener.handler, listener.capture);
  document.body.append(form);
  return { form, inputs, button, cleanup: () => form.remove() };
}

describe.each<[string, Attach]>([
  ["useFormReset", (input, onReset) => void useFormReset(input, "", onReset)],
  ["onFormReset", (input, onReset) => onFormReset({}, input, onReset)],
])("%s", (_name, attach) => {
  it("should call onReset on reset", () => {
    const onReset = vi.fn();
    const { inputs, button, cleanup } = setup(1);
    attach(inputs[0], onReset);
    button.click();
    expect(onReset).toHaveBeenCalled();
    cleanup();
  });

  it("should call onReset on reset even if event is stopped", () => {
    const onReset = vi.fn();
    const { inputs, button, cleanup } = setup(1, { capture: false, handler: (e) => e.stopPropagation() });
    attach(inputs[0], onReset);
    button.click();
    expect(onReset).toHaveBeenCalled();
    cleanup();
  });

  it("should call every onReset on reset", () => {
    const onReset1 = vi.fn();
    const onReset2 = vi.fn();
    const { inputs, button, cleanup } = setup(2);
    attach(inputs[0], onReset1);
    attach(inputs[1], onReset2);
    button.click();
    expect(onReset1).toHaveBeenCalled();
    expect(onReset2).toHaveBeenCalled();
    cleanup();
  });

  it.skip("should not call onReset if reset is cancelled (skipped upstream)", () => {});

  it("should not call onReset if reset is cancelled in capture phase", () => {
    const onReset = vi.fn();
    const { inputs, button, cleanup } = setup(1, { capture: true, handler: (e) => e.preventDefault() });
    attach(inputs[0], onReset);
    button.click();
    expect(onReset).not.toHaveBeenCalled();
    cleanup();
  });

  it("should not call any onReset if reset is cancelled", () => {
    const onReset1 = vi.fn();
    const onReset2 = vi.fn();
    const { inputs, button, cleanup } = setup(2, { capture: true, handler: (e) => e.preventDefault() });
    attach(inputs[0], onReset1);
    attach(inputs[1], onReset2);
    button.click();
    expect(onReset1).not.toHaveBeenCalled();
    expect(onReset2).not.toHaveBeenCalled();
    cleanup();
  });
});
