// DOM-target suite: `Toast` (upstream tests/components/toast/toast.test.tsx ported to happy-dom, fake timers): nothing until a toast
// is queued; region data-slot + notification-count label, region variables + custom / function styles + width; default children
// (alertdialog, frontmost, variant class, title / description, indicator + default icon, Close); `indicator: null` / custom
// indicator; onClose at dismissal + exit duration; auto-dismiss; persistent update; onClose kept on update; promise settle;
// timer reset; clear (onClose each, exiting, batched exiting notification); stacking (newest frontmost, count label);
// data-hidden + inert past maxVisibleToasts; keyboard focus moves to the remaining toast; Alt+T / Escape expansion; the
// stately notify method; data-swapped after a promise-style update; function children; custom style merged with the stacking
// style; placement BEM modifiers; tab order (keyboard close + focus moving to the remaining toast: Chromium); custom aria-label; configurable / modifier-strict / disabled hotkey.
// Rivet: in-place update of the default toast (same node), action button, `toast.*` helpers, compound statics, parts outside a
// provider. CSS-dependent cases (opacity / pointer-events of the stacking style, enter / exit animation): `tests-components/toast.test.ts`.
import { afterEach, beforeEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

const window = installOverlayDom();
// The cdk queue wakes resumed regions with a document CustomEvent: use the happy-dom constructor.
(globalThis as { CustomEvent: unknown }).CustomEvent = (window as unknown as { CustomEvent: unknown }).CustomEvent;

const { render } = await import("@rivetjs/runtime/testing");
const mod = await import("../src/components/toast/index.ts");
const { DEFAULT_EXIT_DURATION, DEFAULT_TOAST_TIMEOUT, Toast, ToastQueue, toast, toastVariants } = mod;

type Win = typeof globalThis & { KeyboardEvent: typeof KeyboardEvent; PointerEvent: typeof PointerEvent; MouseEvent: typeof MouseEvent };
const w = window as unknown as Win;

const region = () => document.querySelector("[role=region]") as HTMLElement | null;
const toasts = () => [...document.querySelectorAll("[role=alertdialog]")] as HTMLElement[];
const slot = (name: string) => document.querySelector(`[data-slot="${name}"]`) as HTMLElement | null;
const closeButton = () => document.querySelector('[data-slot="toast-close"]') as HTMLElement;
const advance = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
};
const tick = () => vi.advanceTimersByTimeAsync(0);
const press = (el: Element) => {
  el.dispatchEvent(new w.PointerEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, pointerId: 1, pointerType: "mouse" }));
  el.dispatchEvent(new w.PointerEvent("pointerup", { bubbles: true, cancelable: true, button: 0, pointerId: 1, pointerType: "mouse" }));
  el.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0, detail: 1 }));
};
const key = (target: EventTarget, init: KeyboardEventInit) => {
  target.dispatchEvent(new w.KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }));
  target.dispatchEvent(new w.KeyboardEvent("keyup", { bubbles: true, cancelable: true, ...init }));
};
const styleOf = (el: HTMLElement, name: string) => el.style.getPropertyValue(name);

let mounted: { unmount(): void }[] = [];
const mount = (factory: () => unknown) => {
  const r = render(factory as never);
  mounted.push(r);
  return r;
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(async () => {
  for (const r of mounted) r.unmount();
  mounted = [];
  toast.clear();
  await vi.runAllTimersAsync();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

test("renders nothing until a toast is queued", () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider queue={queue} />);
  assert.equal(region(), null);
});

test("renders the region with data-slot and an accessible notification count label", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider queue={queue} />);
  queue.add({ title: "Saved" });
  await tick();
  assert.equal(region()?.getAttribute("data-slot"), "toast-region");
  assert.equal(region()?.getAttribute("aria-label"), "1 notification.");
});

test("merges custom styles with the default region variables", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider queue={queue} style={{ "z-index": 100000 }} />);
  queue.add({ title: "Saved" });
  await tick();
  const el = region()!;
  assert.equal(styleOf(el, "--gap"), "12px");
  assert.equal(styleOf(el, "--placement"), "bottom");
  assert.equal(styleOf(el, "--scale-factor"), "0.05");
  assert.equal(styleOf(el, "--toast-width"), "460px");
  assert.equal(styleOf(el, "z-index"), "100000");
});

test("supports overriding a region variable through custom styles", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider queue={queue} style={{ "--toast-width": "320px" }} />);
  queue.add({ title: "Saved" });
  await tick();
  assert.equal(styleOf(region()!, "--gap"), "12px");
  assert.equal(styleOf(region()!, "--toast-width"), "320px");
});

test("supports the width prop alongside custom styles", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider queue={queue} style={{ "z-index": 100000 }} width={520} />);
  queue.add({ title: "Saved" });
  await tick();
  assert.equal(styleOf(region()!, "--toast-width"), "520px");
  assert.equal(styleOf(region()!, "z-index"), "100000");
});

test("supports a style render function on the region", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider queue={queue} style={() => ({ "z-index": 100000 })} />);
  queue.add({ title: "Saved" });
  await tick();
  assert.equal(styleOf(region()!, "--toast-width"), "460px");
  assert.equal(styleOf(region()!, "z-index"), "100000");
});

test("renders default children with alertdialog role, title, description, and close button", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider queue={queue} />);
  queue.add({ description: "Your changes have been saved.", title: "Saved", variant: "success" });
  await tick();
  const el = toasts()[0]!;
  assert.equal(el.getAttribute("data-slot"), "toast");
  assert.equal(el.getAttribute("data-frontmost"), "true");
  assert.ok(el.className.includes("toast--success"), el.className);
  assert.equal(slot("toast-title")?.textContent, "Saved");
  assert.equal(slot("toast-description")?.textContent, "Your changes have been saved.");
  assert.ok(slot("toast-indicator"));
  assert.ok(slot("toast-default-icon"));
  assert.equal(closeButton().getAttribute("aria-label"), "Close");
});

test("renders no indicator when indicator is null", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider queue={queue} />);
  queue.add({ indicator: null, title: "No icon" });
  await tick();
  assert.ok(slot("toast-title"));
  assert.equal(slot("toast-indicator"), null);
});

test("renders a custom indicator instead of the default icon", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider queue={queue} />);
  queue.add({ indicator: <span data-testid="custom-indicator" />, title: "Custom" });
  await tick();
  assert.ok(document.querySelector('[data-testid="custom-indicator"]'));
  assert.equal(slot("toast-default-icon"), null);
});

test("calls onClose when the close button is pressed", async () => {
  const queue = new ToastQueue();
  let closes = 0;
  mount(() => <Toast.Provider queue={queue} />);
  queue.add({ title: "Dismiss me" }, { onClose: () => closes++ });
  await tick();
  assert.equal(toasts().length, 1);
  press(closeButton());
  await tick();
  // onClose fires at dismissal, while the exit animation is still playing.
  assert.equal(closes, 1);
  assert.equal(toasts()[0]?.getAttribute("data-exiting"), "true");
  await advance(DEFAULT_EXIT_DURATION);
  assert.equal(closes, 1);
  assert.equal(document.querySelector("[role=alertdialog]"), null);
});

test("supports auto-dismiss after the default timeout", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider queue={queue} />);
  queue.add({ title: "Auto dismiss" });
  await tick();
  assert.equal(toasts().length, 1);
  await advance(DEFAULT_TOAST_TIMEOUT);
  assert.equal(toasts()[0]?.getAttribute("data-exiting"), "true");
  await advance(DEFAULT_EXIT_DURATION);
  assert.equal(toasts().length, 0);
});

test("supports updating a persistent toast without starting a countdown (in place)", async () => {
  mount(() => <Toast.Provider />);
  const id = toast("Saving", { timeout: 0 });
  await tick();
  const before = toasts()[0]!;
  toast.update(id, "Saved", { variant: "success" });
  await tick();
  await advance(DEFAULT_TOAST_TIMEOUT * 2);
  const el = toasts()[0]!;
  assert.equal(el, before, "same toast node");
  assert.equal(slot("toast-title")?.textContent, "Saved");
  assert.ok(el.className.includes("toast--success"), el.className);
});

test("calls the original onClose when an update omits it", async () => {
  let closes = 0;
  mount(() => <Toast.Provider />);
  const id = toast("Saving", { onClose: () => closes++, timeout: 0 });
  await tick();
  toast.update(id, "Saved");
  toast.close(id);
  assert.equal(closes, 1);
  await advance(DEFAULT_EXIT_DURATION);
});

test("supports auto-dismiss once a promise toast settles", async () => {
  mount(() => <Toast.Provider />);
  toast.promise(Promise.resolve("ok"), { error: "Failed", loading: "Uploading", success: "Uploaded" });
  await tick();
  assert.equal(slot("toast-title")?.textContent, "Uploaded");
  await advance(DEFAULT_TOAST_TIMEOUT);
  await advance(DEFAULT_EXIT_DURATION);
  assert.equal(toasts().length, 0);
});

test("supports restarting a running timer through reset", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider queue={queue} />);
  queue.add({ title: "Auto dismiss" }, { timeout: 1_000 });
  await tick();
  const { timer } = queue.getQueue().visibleToasts[0]! as unknown as { timer: { reset: (delay: number) => void } };
  await advance(500);
  timer.reset(4_000);
  await advance(1_000);
  assert.equal(toasts().length, 1);
  assert.equal(toasts()[0]!.hasAttribute("data-exiting"), false);
  await advance(3_000);
  await advance(DEFAULT_EXIT_DURATION);
  assert.equal(toasts().length, 0);
});

test("calls each onClose at dismissal and removes all toasts after clear", async () => {
  const queue = new ToastQueue();
  const calls: string[] = [];
  mount(() => <Toast.Provider queue={queue} />);
  queue.add({ title: "First" }, { onClose: () => calls.push("a") });
  queue.add({ title: "Second" }, { onClose: () => calls.push("b") });
  await tick();
  queue.clear();
  await tick();
  assert.deepEqual(calls.sort(), ["a", "b"]);
  const exiting = toasts();
  assert.equal(exiting.length, 2);
  for (const el of exiting) {
    assert.equal(el.getAttribute("data-exiting"), "true");
    assert.equal(el.getAttribute("aria-hidden"), "true");
  }
  await advance(DEFAULT_EXIT_DURATION);
  assert.equal(toasts().length, 0);
  assert.equal(calls.length, 2);
});

test("exposes a single batched exiting-state notification for clear", () => {
  const queue = new ToastQueue();
  const inner = queue.getQueue() as unknown as { getExitingKeys: () => ReadonlySet<string>; subscribeExiting: (fn: () => void) => () => void };
  queue.add({ title: "One" });
  queue.add({ title: "Two" });
  queue.add({ title: "Three" });
  let notified = 0;
  inner.subscribeExiting(() => notified++);
  queue.clear();
  assert.equal(notified, 1);
  assert.equal(inner.getExitingKeys().size, 3);
  queue.destroy();
});

test("exposes stacked toasts with newest frontmost and indexed", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider queue={queue} />);
  queue.add({ title: "First" });
  queue.add({ title: "Second" });
  await tick();
  const list = toasts();
  assert.equal(list.length, 2);
  const frontmost = list.find((t) => t.getAttribute("data-frontmost") === "true");
  assert.ok(frontmost?.textContent?.includes("Second"));
  assert.deepEqual(
    list.map((t) => t.getAttribute("data-index")),
    ["0", "1"],
  );
  assert.equal(region()?.getAttribute("aria-label"), "2 notifications.");
});

test("exposes data-hidden on toasts beyond maxVisibleToasts", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider maxVisibleToasts={1} queue={queue} />);
  queue.add({ title: "First" });
  queue.add({ title: "Second" });
  await tick();
  const list = toasts();
  const hidden = list.find((t) => t.getAttribute("data-hidden") === "true");
  const visible = list.find((t) => !t.hasAttribute("data-hidden"));
  assert.ok(hidden?.textContent?.includes("First"));
  assert.ok(visible?.textContent?.includes("Second"));
  // Hidden toasts are inert so their controls leave the tab order.
  assert.ok(hidden!.hasAttribute("inert"));
  assert.ok(!visible!.hasAttribute("inert"));
});

test("supports Alt+T to focus and expand the stack and Escape to collapse it", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider queue={queue} />);
  queue.add({ title: "First" });
  queue.add({ title: "Second" });
  await tick();
  key(document, { key: "t", code: "KeyT", altKey: true });
  await tick();
  const el = region()!;
  assert.equal(document.activeElement, el);
  assert.equal(el.getAttribute("data-expanded"), "true");
  assert.ok(toasts().every((t) => t.getAttribute("data-expanded") === "true"));
  key(el, { key: "Escape", code: "Escape" });
  await tick();
  assert.equal(el.hasAttribute("data-expanded"), false);
  assert.notEqual(document.activeElement, el);
});

test("exposes the react-stately method that in-place updates notify through", () => {
  const inner = new ToastQueue().getQueue() as unknown as Record<string, unknown>;
  assert.equal(typeof inner["updateVisibleToasts"], "function");
});

test("exposes data-swapped on the indicator after a promise-style update", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider queue={queue} />);
  const k = queue.add({ isLoading: true, title: "Uploading" });
  await tick();
  const indicator = slot("toast-indicator")!;
  assert.ok(indicator.querySelector('[data-slot="spinner"]'));
  assert.equal(indicator.hasAttribute("data-swapped"), false);
  queue.update(k, { title: "Uploaded", variant: "success" });
  await tick();
  assert.equal(slot("toast-indicator"), indicator, "same indicator node");
  assert.equal(indicator.getAttribute("data-swapped"), "true");
  assert.ok(slot("toast-default-icon"));
});

test("supports custom render children via Toast.Provider function-as-children", async () => {
  const queue = new ToastQueue();
  mount(() => (
    <Toast.Provider queue={queue}>
      {({ toast: toastItem }) => (
        <Toast data-testid="custom-toast" toast={toastItem}>
          <Toast.Content>
            <Toast.Title>Custom layout</Toast.Title>
          </Toast.Content>
        </Toast>
      )}
    </Toast.Provider>
  ));
  queue.add({ title: "ignored" });
  await tick();
  assert.ok(document.querySelector('[data-testid="custom-toast"]'));
  assert.equal(slot("toast-title")?.textContent, "Custom layout");
});

test("merges custom styles with the toast stacking styles", async () => {
  const queue = new ToastQueue();
  mount(() => (
    <Toast.Provider queue={queue}>
      {({ toast: toastItem }) => (
        <Toast data-testid="custom-toast" style={{ "margin-top": "8px" }} toast={toastItem}>
          <Toast.Content>
            <Toast.Title>Custom layout</Toast.Title>
          </Toast.Content>
        </Toast>
      )}
    </Toast.Provider>
  ));
  queue.add({ title: "ignored" });
  await tick();
  const el = document.querySelector('[data-testid="custom-toast"]') as HTMLElement;
  assert.equal(styleOf(el, "margin-top"), "8px");
  assert.equal(styleOf(el, "z-index"), "1");
  assert.equal(styleOf(el, "--offset-collapsed"), "0px");
});

test("exposes placement BEM modifiers on the region and toast", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider placement="top end" queue={queue} />);
  queue.add({ title: "Top end" });
  await tick();
  assert.ok(region()!.className.includes("toast-region--top-end"), region()!.className);
  assert.ok(toasts()[0]!.className.includes("toast--top-end"), toasts()[0]!.className);
  assert.equal(toasts()[0]!.getAttribute("data-placement"), "top end");
});

test("frontmost toast and its close button are in the tab order (keyboard close: Chromium suite)", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider queue={queue} />);
  queue.add({ title: "Back" });
  queue.add({ title: "Keyboard close" });
  await tick();
  const [front, back] = toasts();
  assert.equal(front!.tabIndex, 0);
  assert.equal(back!.tabIndex, -1);
  assert.notEqual(closeButton().tabIndex, -1);
});

test("supports a custom aria-label for the toast region", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider aria-label="Notifications" queue={queue} />);
  queue.add({ title: "Saved" });
  await tick();
  assert.equal(region()?.getAttribute("aria-label"), "Notifications");
});

test("supports a configurable hotkey", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider hotkey={["ctrlKey", "KeyN"]} queue={queue} />);
  queue.add({ title: "First" });
  queue.add({ title: "Second" });
  await tick();
  // The default hotkey is replaced, so Alt+T no longer focuses the region.
  key(document, { key: "t", code: "KeyT", altKey: true });
  assert.notEqual(document.activeElement, region());
  key(document, { key: "n", code: "KeyN", ctrlKey: true });
  await tick();
  assert.equal(document.activeElement, region());
  assert.equal(region()!.getAttribute("data-expanded"), "true");
});

test("does not focus the region when extra modifiers are held", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider queue={queue} />);
  queue.add({ title: "First" });
  queue.add({ title: "Second" });
  await tick();
  key(document, { key: "t", code: "KeyT", altKey: true, ctrlKey: true });
  assert.notEqual(document.activeElement, region());
  key(document, { key: "t", code: "KeyT", altKey: true, shiftKey: true });
  assert.notEqual(document.activeElement, region());
  key(document, { key: "t", code: "KeyT", altKey: true });
  assert.equal(document.activeElement, region());
});

test("does not focus the region when the hotkey is disabled", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider hotkey={[]} queue={queue} />);
  queue.add({ title: "First" });
  queue.add({ title: "Second" });
  await tick();
  key(document, { key: "t", code: "KeyT", altKey: true });
  assert.notEqual(document.activeElement, region());
});

// Rivet additions

test("default toast: action button (desktop: after the content), toast.* variant helpers", async () => {
  mount(() => <Toast.Provider />);
  let pressed = 0;
  toast.success("Done", { actionProps: { children: "Undo", onPress: () => pressed++ } });
  await tick();
  const action = slot("toast-action-button")!;
  assert.equal(action.textContent, "Undo");
  assert.ok(action.className.includes("toast__action"), action.className);
  assert.equal(action.parentElement?.getAttribute("data-slot"), "toast");
  press(action);
  assert.equal(pressed, 1);
  assert.ok(toasts()[0]!.className.includes("toast--success"));
  toast.danger("Bad");
  toast.info("Info");
  toast.warning("Warn");
  await tick();
  assert.deepEqual(
    toasts().map((t) => /toast--(default|accent|success|warning|danger)\b/.exec(t.className)?.[1]),
    ["warning", "accent", "danger", "success"],
  );
});

test("default toast: hover pauses the timers, leaving resumes them", async () => {
  const queue = new ToastQueue();
  mount(() => <Toast.Provider queue={queue} />);
  queue.add({ title: "Hover" }, { timeout: 1_000 });
  await tick();
  region()!.dispatchEvent(new w.PointerEvent("pointerenter", { pointerType: "mouse" }));
  await advance(2_000);
  assert.equal(toasts()[0]!.hasAttribute("data-exiting"), false);
  region()!.dispatchEvent(new w.PointerEvent("pointerleave", { pointerType: "mouse" }));
  await advance(1_000);
  assert.equal(toasts()[0]?.getAttribute("data-exiting"), "true");
});

test("compound statics, constants and variants", () => {
  assert.equal(Toast.Provider, mod.ToastProvider);
  assert.equal(Toast.Content, mod.ToastContent);
  assert.equal(Toast.Indicator, mod.ToastIndicator);
  assert.equal(Toast.Title, mod.ToastTitle);
  assert.equal(Toast.Description, mod.ToastDescription);
  assert.equal(Toast.ActionButton, mod.ToastActionButton);
  assert.equal(Toast.CloseButton, mod.ToastCloseButton);
  assert.equal(Toast.Queue, ToastQueue);
  assert.equal(Toast.toast, toast);
  assert.equal(mod.toastQueue.getQueue(), toast.getQueue());
  assert.equal(DEFAULT_EXIT_DURATION, 300);
  assert.equal(DEFAULT_TOAST_TIMEOUT, 4000);
  assert.deepEqual(mod.DEFAULT_HOTKEY, ["altKey", "KeyT"]);
  assert.equal(toastVariants({ placement: "top" }).region(), "toast-region toast-region--top");
});

test("parts outside a provider render without the slot classes", () => {
  mount(() => (
    <div>
      <Toast.Indicator class="x" />
      <Toast.Title class="t">Title</Toast.Title>
    </div>
  ));
  assert.equal(slot("toast-indicator")?.getAttribute("class"), "x");
  assert.ok(slot("toast-default-icon"));
  assert.equal(slot("toast-title")?.getAttribute("class"), "t");
});
