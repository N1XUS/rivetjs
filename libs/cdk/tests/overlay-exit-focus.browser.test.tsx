// An overlay's focus containment ends when its exit starts: focus moved during the exit animation stays where it went
// (hrnss: a menu action opening an inline editor; a shortcut right after a dialog closed).
import { afterEach, expect, it } from "vitest";
import { signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { Overlay } from "../portal/index.tsx";

afterEach(cleanup);

const frames = async () => {
  for (let i = 0; i < 3; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
  await flush();
};

it("a containing Overlay stops holding focus once isExiting turns true", async () => {
  const exiting = signal(false);
  render(() => (
    <div>
      <input data-testid="outside" />
      <Overlay shouldContainFocus isExiting={exiting}>
        <input data-testid="inside" />
      </Overlay>
    </div>
  ));
  await flush();
  const inside = document.querySelector<HTMLInputElement>('[data-testid="inside"]')!;
  const outside = document.querySelector<HTMLInputElement>('[data-testid="outside"]')!;
  inside.focus();
  outside.focus();
  await frames();
  expect(document.activeElement).toBe(inside);
  exiting.set(true);
  await flush();
  expect(inside.closest("[data-rv-contain]")).toBe(null);
  outside.focus();
  await frames();
  expect(document.activeElement).toBe(outside);
});
