// Rivet custom-root focus, direction and DOM-prop contracts; happy-dom does not model layout.
import { afterEach, beforeEach, test, vi } from "vitest";
import assert from "node:assert/strict";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { provide } from "@rivetjs/reactivity";
import { installDom, mockLayout } from "./install-dom.ts";
import { containFocus, saveFocus, roveFocus, inertOutside } from "@rivetjs/cdk/focus";
import { announce, clearAnnouncements } from "@rivetjs/cdk/a11y";
import { createDir, DirectionalityContext, setDir, useDirection, logicalKey } from "@rivetjs/cdk/bidi";
import { textInputDOMProps } from "@rivetjs/cdk/dom-props";
import { getOffset, renderElement } from "@rivetjs/cdk/utils";
import { labelsAttrs } from "@rivetjs/cdk/label/behaviour";
import { idSignal, mergeIds, releaseId, withIdScope, createId } from "@rivetjs/cdk/id";

const dom = installDom();
beforeEach(() => dom.reset());
afterEach(() => {
  clearAnnouncements();
  vi.useRealTimers();
});

function controls() {
  document.body.innerHTML = `<button id="trigger">Open</button><div id="scope"><button id="first">First</button><button id="last">Last</button></div><button id="outside">Elsewhere</button>`;
  const scope = document.querySelector<HTMLElement>("#scope")!;
  const first = document.querySelector<HTMLButtonElement>("#first")!;
  const last = document.querySelector<HTMLButtonElement>("#last")!;
  return {
    scope,
    first,
    last,
    trigger: document.querySelector<HTMLButtonElement>("#trigger")!,
    outside: document.querySelector<HTMLButtonElement>("#outside")!,
  };
}

test("containFocus wraps both ends, permits internal Tab and ignores modifier shortcuts", () => {
  const { scope, first, last } = controls();
  scope.addEventListener("keydown", (event) => containFocus(scope, event));
  last.focus();
  const next = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
  last.dispatchEvent(next);
  assert.equal(next.defaultPrevented, true);
  assert.equal(document.activeElement, first);
  first.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
  assert.equal(document.activeElement, last);
  first.focus();
  const middle = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
  first.dispatchEvent(middle);
  assert.equal(middle.defaultPrevented, false);
  const shortcut = new KeyboardEvent("keydown", { key: "Tab", ctrlKey: true, cancelable: true });
  assert.equal(containFocus(scope, shortcut), false);
  scope.replaceChildren();
  const empty = new KeyboardEvent("keydown", { key: "Tab", cancelable: true });
  assert.equal(containFocus(scope, empty), true);
  assert.equal(empty.defaultPrevented, true);
});

test("saveFocus restores the trigger only when focus has not moved outside the overlay", () => {
  const { scope, first, trigger, outside } = controls();
  trigger.focus();
  const restore = saveFocus(scope);
  first.focus();
  restore();
  assert.equal(document.activeElement, trigger);
  outside.focus();
  restore();
  assert.equal(document.activeElement, outside);
  trigger.remove();
  first.focus();
  restore();
  assert.equal(document.activeElement, first);
});

test("roveFocus makes exactly one item tabbable and moves actual focus", () => {
  const { first, last } = controls();
  roveFocus([first, last], last);
  assert.equal(first.tabIndex, -1);
  assert.equal(last.tabIndex, 0);
  assert.equal(document.activeElement, last);
  roveFocus([first, last], first);
  assert.equal(first.tabIndex, 0);
  assert.equal(last.tabIndex, -1);
});

test("inertOutside restores only attributes it added and excludes scripts", () => {
  document.body.innerHTML = `<main><aside inert></aside><section id="modal"></section><button>Sibling</button></main><footer>Outside</footer><script></script>`;
  const restore = inertOutside(document.querySelector("#modal")!);
  assert.equal(document.querySelector("button")!.hasAttribute("inert"), true);
  assert.equal(document.querySelector("footer")!.hasAttribute("inert"), true);
  assert.equal(document.querySelector("main")!.hasAttribute("inert"), false);
  assert.equal(document.querySelector("script")!.hasAttribute("inert"), false);
  restore();
  assert.equal(document.querySelector("aside")!.hasAttribute("inert"), true);
  assert.equal(document.querySelector("button")!.hasAttribute("inert"), false);
  assert.equal(document.querySelector("footer")!.hasAttribute("inert"), false);
});

test("clearing announcements cancels pending messages in both live regions", () => {
  vi.useFakeTimers();
  announce("Saved");
  announce("Error", "assertive");
  vi.advanceTimersByTime(50);
  assert.equal(document.querySelector('[aria-live="polite"]')!.textContent, "Saved");
  announce("Queued");
  clearAnnouncements();
  vi.advanceTimersByTime(50);
  assert.deepEqual(
    [...document.querySelectorAll("[data-rv-announcer]")].map((el) => el.textContent),
    ["", ""],
  );
});

test("direction accessor follows its provided scope and swaps only horizontal keys", () => {
  const dir = createDir("ltr");
  const read = provide(DirectionalityContext, dir, () => useDirection());
  assert.equal(read(), "ltr");
  setDir(dir, "rtl");
  assert.equal(read(), "rtl");
  assert.equal(logicalKey("ArrowLeft", read()), "ArrowRight");
  assert.equal(logicalKey("ArrowRight", read()), "ArrowLeft");
  assert.equal(logicalKey("ArrowDown", read()), "ArrowDown");
  assert.equal(logicalKey("ArrowLeft", "ltr"), "ArrowLeft");
});

test("text input props forward live handlers without reading them and exclude owned events", () => {
  let reads = 0;
  const paste = vi.fn(),
    next = vi.fn();
  let handler = paste;
  const props = {
    onInput: vi.fn(),
    get onPaste() {
      reads++;
      return handler;
    },
    onCopyCapture: vi.fn(),
    onClick: vi.fn(),
    value: "private",
  };
  const attrs = textInputDOMProps(props);
  assert.equal(reads, 0);
  assert.deepEqual(Object.keys(attrs).sort(), ["onCopyCapture", "onPaste"]);
  assert.equal(attrs.onPaste, paste);
  handler = next;
  assert.equal(attrs.onPaste, next);
  assert.equal(textInputDOMProps(props, []).onInput, props.onInput);
});

test("getOffset uses the requested axis and edge of the client rectangle", () => {
  const element = document.createElement("div");
  mockLayout(element, { left: 11, top: 17, width: 31, height: 43 });
  assert.equal(getOffset(element), 11);
  assert.equal(getOffset(element, true), 42);
  assert.equal(getOffset(element, false, "vertical"), 17);
  assert.equal(getOffset(element, true, "vertical"), 60);
});

test("renderElement forwards the same props and state to the selected renderer only", () => {
  const props = { id: "custom" },
    state = { selected: true };
  const fallbackNode = document.createElement("div") as unknown as JSX.Element;
  const customNode = document.createElement("section") as unknown as JSX.Element;
  const fallback = vi.fn(() => fallbackNode);
  const render = vi.fn((attrs, values) => {
    assert.equal(attrs, props);
    assert.equal(values, state);
    return customNode;
  });
  assert.equal(renderElement(render, props, state, fallback), customNode);
  assert.equal(fallback.mock.calls.length, 0);
  assert.equal(renderElement(undefined, props, state, fallback), fallbackNode);
  assert.equal(fallback.mock.calls.length, 1);
});

test("labelsAttrs includes the field's own name once when combining label sources", () => {
  assert.deepEqual(labelsAttrs("field", "Custom", " external  field "), { id: "field", "aria-label": "Custom", "aria-labelledby": "field external" });
  assert.equal(labelsAttrs("field", undefined, undefined, "Fallback")["aria-label"], "Fallback");
});

test("releaseId disconnects obsolete ids from future merges; nested id scopes restore the parent counter", () => {
  const live = idSignal("retired");
  releaseId("retired");
  assert.equal(mergeIds("retired", "replacement"), "replacement");
  assert.equal(live(), "retired");
  assert.deepEqual(
    withIdScope("outer-", () => [createId(), withIdScope("inner-", () => createId()), createId()]),
    ["outer-0", "inner-0", "outer-1"],
  );
});
