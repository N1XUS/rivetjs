// Ported from react-aria/test/interactions/useFocusVisible.test.js (adobe/react-spectrum @ 06891de), Apache-2.0, © Adobe.
// Rivet: React renderHook becomes an owned signal factory; happy-dom + user-event drive the input modality.
import { beforeEach, afterEach, test } from "vitest";
import assert from "node:assert/strict";
import { userEvent } from "@testing-library/user-event";
import { createRoot, signal } from "@rivetjs/reactivity";
import { flush } from "@rivetjs/runtime/testing";
import { pointerMap } from "@rivetjs/testing/user";
import { installDom } from "./install-dom.ts";
import {
  addWindowFocusTracking,
  createFocusVisible,
  createInteractionModality,
  watchFocusVisible,
  setInteractionModality,
  _setInteractionModality,
} from "@rivetjs/cdk/interactions/focus-visible";

const dom = installDom();
let disposers: (() => void)[] = [];
beforeEach(() => {
  dom.reset();
  _setInteractionModality(null);
});
afterEach(() => {
  for (const dispose of disposers.reverse()) dispose();
  disposers = [];
  _setInteractionModality(null);
});

test("focus-visible and modality signals follow keyboard and pointer input and stop on disposal", async () => {
  document.body.innerHTML = "<button>Action</button>";
  const root = createRoot(() => ({ visible: createFocusVisible().isFocusVisible, modality: createInteractionModality() }));
  disposers.push(root.dispose);
  await flush();
  const user = userEvent.setup({ document, delay: null, pointerMap });
  await user.tab();
  assert.equal(root.value.visible(), true);
  assert.equal(root.value.modality(), "keyboard");
  await user.click(document.querySelector("button")!);
  assert.equal(root.value.visible(), false);
  assert.equal(root.value.modality(), "pointer");
  root.dispose();
  await user.keyboard("{Enter}");
  assert.equal(root.value.visible(), false);
  assert.equal(root.value.modality(), "pointer");
});

test("focus-visible listener can be disabled and enabled reactively", async () => {
  const enabled = signal(false),
    changes: boolean[] = [];
  const root = createRoot(() => watchFocusVisible((visible) => changes.push(visible), { enabled }));
  disposers.push(root.dispose);
  await flush();
  setInteractionModality("pointer");
  assert.deepEqual(changes, []);
  enabled.set(true);
  await flush();
  setInteractionModality("keyboard");
  assert.deepEqual(changes, [true]);
  enabled.set(false);
  await flush();
  setInteractionModality("pointer");
  assert.deepEqual(changes, [true]);
});

test("tracking a second window is removed by its teardown function", async () => {
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  const win = iframe.contentWindow! as Window & typeof globalThis;
  const target = win.document.createElement("button");
  win.document.body.append(target);
  const root = createRoot(() => createInteractionModality());
  disposers.push(root.dispose);
  await flush();
  const stop = addWindowFocusTracking(target);
  disposers.push(stop);
  win.document.dispatchEvent(new win.Event("DOMContentLoaded"));
  target.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
  assert.equal(root.value(), "keyboard");
  setInteractionModality("pointer");
  stop();
  target.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert.equal(root.value(), "pointer");
});
