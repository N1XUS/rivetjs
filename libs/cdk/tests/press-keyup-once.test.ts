// Rivet test: a held key (repeated keydowns) binds one document keyup listener per keyboard press (FIX2-CDK, review cdk-a-2#6).
import { test } from "vitest";
import assert from "node:assert/strict";
import { installDom } from "./install-dom.ts";

installDom();
const { pressProps } = await import("../interactions/press.tsx");

test("repeated keydowns add one keyup listener; the press ends once on keyup", () => {
  const el = document.createElement("div");
  el.tabIndex = 0;
  el.setAttribute("role", "button");
  document.body.append(el);
  const log: string[] = [];
  const { pressProps: bag } = pressProps({ onPress: () => log.push("press"), onPressEnd: () => log.push("end") });
  el.addEventListener("keydown", (e) => (bag.onKeyDown as (e: KeyboardEvent) => void)(e));
  let keyups = 0;
  const add = document.addEventListener.bind(document);
  document.addEventListener = ((type: string, ...rest: never[]) => {
    if (type === "keyup") keyups++;
    return (add as (...a: unknown[]) => void)(type, ...rest);
  }) as typeof document.addEventListener;
  try {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    for (let i = 0; i < 20; i++) el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true, bubbles: true, cancelable: true }));
    assert.equal(keyups, 1);
    el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true, cancelable: true }));
    assert.deepEqual(log, ["end", "press"]);
    // A second press binds a fresh listener.
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    assert.equal(keyups, 2);
    el.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true, cancelable: true }));
    assert.deepEqual(log, ["end", "press", "end", "press"]);
  } finally {
    document.addEventListener = add as typeof document.addEventListener;
    el.remove();
  }
});
