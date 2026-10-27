import { test } from "vitest";
import assert from "node:assert/strict";
import { SlidesInView } from "../carousel/engine/SlidesInView.ts";

test("large observer deliveries retain first duplicate, unknown targets, array edits and destruction", () => {
  const previous = globalThis.IntersectionObserver;
  let callback!: IntersectionObserverCallback;
  let emissions = 0;
  globalThis.IntersectionObserver = class {
    constructor(cb: IntersectionObserverCallback) {
      callback = cb;
    }
    observe() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
  try {
    const slides = Array.from({ length: 140 }, () => ({}) as HTMLElement);
    const first = slides[0]!;
    slides[139] = first;
    const unknown = {} as HTMLElement;
    const view = SlidesInView(
      { parentElement: null } as HTMLElement,
      slides,
      {
        emit() {
          emissions++;
        },
      } as never,
      0,
    );
    view.init();
    const entry = (target: HTMLElement, isIntersecting = true) => ({ target, isIntersecting }) as unknown as IntersectionObserverEntry;
    const deliver = (entries: IntersectionObserverEntry[]) => callback(entries, {} as IntersectionObserver);
    deliver([...slides.map((slide) => entry(slide)), entry(unknown)]);
    assert.deepEqual(view.get(), [...Array.from({ length: 139 }, (_, i) => i), -1]);
    slides.reverse();
    deliver(Array.from({ length: 140 }, () => entry(slides[1]!, false)));
    assert.deepEqual(view.get(false), [1]);
    view.destroy();
    deliver([entry(first, false)]);
    assert.equal(emissions, 2);
    assert.deepEqual(view.get(false), [1]);
  } finally {
    globalThis.IntersectionObserver = previous;
  }
});
