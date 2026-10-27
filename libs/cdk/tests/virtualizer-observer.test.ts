import { test } from "vitest";
import assert from "node:assert/strict";
import { signal } from "@rivetjs/reactivity";
import { installDom, mockLayout } from "./install-dom.ts";
import { driverOf, type VirtualView, type VirtualizerModel } from "../virtualizer/behaviour.ts";
import { ListLayout } from "../virtualizer/list-layout.ts";

test("observer batch resolves nested views, string collisions and removed keys in delivery order", async () => {
  const dom = installDom();
  const previous = globalThis.ResizeObserver;
  const callbacks: ResizeObserverCallback[] = [];
  globalThis.ResizeObserver = class {
    constructor(cb: ResizeObserverCallback) {
      callbacks.push(cb);
    }
    observe() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  const el = document.createElement("div");
  el.id = "observer-test";
  document.body.append(el);
  mockLayout(el, { width: 300, height: 300 });
  const model: VirtualizerModel<number, any> = {
    id: el.id,
    items: [1, 2],
    layout: () => new ListLayout<number>(),
    layoutOptions: { rowHeight: 30 },
    collection: {},
    initialSize: { width: 300, height: 300 },
    loadMoreOffset: 1,
    shouldObserveItemSize: true,
    persistedKeys: [],
    focusedKey: signal<string | number | null>(null),
    views: signal<VirtualView<number>[]>([]),
    contentSize: signal({ width: 0, height: 0 }),
    isScrolling: signal(false),
  };
  const driver = driverOf(model, el)!;
  try {
    await Promise.resolve();
    const measured: (string | number)[] = [];
    driver.state.virtualizer.updateItemSize = (key) => {
      measured.push(key);
    };
    const v = (key: string | number, children: VirtualView<number>[] = []) => ({ key, children }) as VirtualView<number>;
    model.views.set([v(1, [v("nested")]), v("1"), v("removed")]);
    el.innerHTML = '<div data-rv-view="1"><span></span></div><div data-rv-view="nested"><span></span></div><div data-rv-view="removed"><span></span></div>';
    const entries = [...el.querySelectorAll("span")].map((target) => ({ target }) as unknown as ResizeObserverEntry);
    const deliver = () => callbacks.at(-1)!(entries, {} as ResizeObserver);
    deliver();
    await Promise.resolve();
    assert.deepEqual(measured, [1, "nested", "removed"]);
    measured.length = 0;
    model.views.set([v("1"), v(1, [v("nested")])]);
    deliver();
    await Promise.resolve();
    assert.deepEqual(measured, ["1", "nested"]);
  } finally {
    driver.stop();
    globalThis.ResizeObserver = previous;
    dom.reset();
  }
});
