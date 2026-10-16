// Browser tests for ../../observers/index.ts. Ported from angular/components
// src/cdk/observers/{observe-content,private/shared-resize-observer}.spec.ts (MIT, © Google LLC) and
// react-spectrum packages/react-aria/test/utils/useResizeObserver behaviour (Apache-2.0, © Adobe).
import { describe, it, afterAll as after, beforeAll as before } from "vitest";
import assert from "node:assert/strict";
import type { Page } from "playwright";
import { harness, type Harness } from "./harness.ts";

let h: Harness;
let page: Page;
before(async () => {
  h = await harness();
  page = await h.blank();
});
after(() => h.close());

const reset = () => page.evaluate(() => (document.body.innerHTML = '<div id="root"></div>'));

describe("Observe content (real MutationObserver)", () => {
  it("should trigger the callback when the content of the element changes", async () => {
    await reset();
    const calls = await page.evaluate(async () => {
      const { observeContent } = await import("/observers/index.ts");
      const el = document.createElement("div");
      document.body.append(el);
      let calls = 0;
      observeContent(el, () => calls++);
      el.textContent = "text";
      await new Promise((r) => setTimeout(r));
      return calls;
    });
    assert.ok(calls >= 1);
  });

  it("should trigger the callback when the content of the children changes", async () => {
    await reset();
    const calls = await page.evaluate(async () => {
      const { observeContent } = await import("/observers/index.ts");
      const el = document.createElement("div");
      const child = document.createElement("div");
      el.append(child);
      document.body.append(el);
      let calls = 0;
      observeContent(el, () => calls++);
      child.textContent = "text";
      await new Promise((r) => setTimeout(r));
      return calls;
    });
    assert.ok(calls >= 1);
  });
});

describe("ContentObserver (real behavior)", () => {
  const run = (body: string) =>
    page.evaluate(async (src) => {
      const { createContentObserver } = await import("/observers/index.ts");
      const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const contentEl = document.createElement("div");
      document.body.append(contentEl);
      const spy = { calls: 0 };
      createContentObserver()
        .observe(contentEl)
        .subscribe(() => spy.calls++);
      const fn = new Function("contentEl", "spy", "wait", `return (async () => { ${src} })()`);
      return fn(contentEl, spy, wait);
    }, body);

  it("should ignore addition or removal of comments", async () => {
    await reset();
    const r = await run(`
      const comment = document.createComment("cool");
      await wait(0);
      spy.calls = 0;
      contentEl.appendChild(comment);
      await wait(0);
      const added = spy.calls;
      comment.remove();
      await wait(0);
      return [added, spy.calls];`);
    assert.deepEqual(r, [0, 0]);
  });

  it("should not ignore addition or removal of text", async () => {
    await reset();
    const r = await run(`
      const text = document.createTextNode("cool");
      await wait(0);
      spy.calls = 0;
      contentEl.appendChild(text);
      await wait(0);
      const added = spy.calls;
      spy.calls = 0;
      text.remove();
      await wait(0);
      return [added > 0, spy.calls > 0];`);
    assert.deepEqual(r, [true, true]);
  });

  it("should ignore comment content change", async () => {
    await reset();
    const r = await run(`
      const comment = document.createComment("cool");
      contentEl.appendChild(comment);
      await wait(0);
      spy.calls = 0;
      comment.textContent = "beans";
      await wait(0);
      return spy.calls;`);
    assert.equal(r, 0);
  });

  it("should not ignore text content change", async () => {
    await reset();
    const r = await run(`
      const text = document.createTextNode("cool");
      contentEl.appendChild(text);
      await wait(0);
      spy.calls = 0;
      text.textContent = "beans";
      await wait(0);
      return spy.calls;`);
    assert.ok((r as number) > 0);
  });
});

describe("SharedResizeObserver", () => {
  // MockResizeObserver: triggers the callback on observe (like the native one) and on demand.
  const setup = () =>
    page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const current = new Map<string, { trigger(target: Element): void }>();
      w.__original ??= window.ResizeObserver;
      class MockResizeObserver {
        _callback: ResizeObserverCallback;
        constructor(callback: ResizeObserverCallback, options?: ResizeObserverOptions) {
          this._callback = callback;
          current.set(options?.box || "content-box", this);
        }
        observe(element: Element) {
          this.trigger(element);
        }
        unobserve() {}
        disconnect() {}
        trigger(target: Element) {
          this._callback([{ target, borderBoxSize: [], contentBoxSize: [], devicePixelContentBoxSize: [], contentRect: {} as DOMRect }], this as never);
        }
      }
      // The mock is installed before the observer is created (per box, on first observe).
      window.ResizeObserver = MockResizeObserver as never;
      w.__current = current;
      document.body.innerHTML = '<div id="el1"></div><div id="el2"></div>';
    });
  const teardown = () => page.evaluate(() => (window.ResizeObserver = (window as unknown as { __original: typeof ResizeObserver }).__original));

  it("observable identity: same element + box, different elements, different boxes, after unsubscribe", async () => {
    await setup();
    const r = await page.evaluate(async () => {
      const { createSharedResizeObserver } = await import("/observers/index.ts");
      const ro = createSharedResizeObserver();
      const el1 = document.getElementById("el1")!;
      const el2 = document.getElementById("el2")!;
      const same = ro.observe(el1) === ro.observe(el1);
      const differentEls = ro.observe(el1) !== ro.observe(el2);
      const differentBoxes = ro.observe(el1, { box: "content-box" }) !== ro.observe(el1, { box: "border-box" });
      const observable1 = ro.observe(el1);
      const subscription1 = observable1.subscribe(() => {});
      const subscription2 = observable1.subscribe(() => {});
      subscription1.unsubscribe();
      const sameWhileSubscribed = ro.observe(el1) === observable1;
      subscription2.unsubscribe();
      const newAfterAll = ro.observe(el1) !== observable1;
      ro.destroy();
      return { same, differentEls, differentBoxes, sameWhileSubscribed, newAfterAll };
    });
    await teardown();
    assert.deepEqual(r, { same: true, differentEls: true, differentBoxes: true, sameWhileSubscribed: true, newAfterAll: true });
  });

  it("should receive an initial size on subscription (also a later subscriber)", async () => {
    await setup();
    const r = await page.evaluate(async () => {
      const { createSharedResizeObserver } = await import("/observers/index.ts");
      const ro = createSharedResizeObserver();
      const observable = ro.observe(document.getElementById("el1")!);
      let first = 0;
      let second = 0;
      observable.subscribe(() => first++);
      observable.subscribe(() => second++);
      ro.destroy();
      return [first, second];
    });
    await teardown();
    assert.deepEqual(r, [1, 1]);
  });

  it("should receive events on resize, not for other elements", async () => {
    await setup();
    const r = await page.evaluate(async () => {
      const { createSharedResizeObserver } = await import("/observers/index.ts");
      const current = (window as unknown as { __current: Map<string, { trigger(t: Element): void }> }).__current;
      const ro = createSharedResizeObserver();
      const el1 = document.getElementById("el1")!;
      const el2 = document.getElementById("el2")!;
      let spy1 = 0;
      let spy2 = 0;
      ro.observe(el1).subscribe(() => spy1++);
      ro.observe(el2).subscribe(() => spy2++);
      spy1 = spy2 = 0;
      current.get("content-box")!.trigger(el1);
      ro.destroy();
      return [spy1, spy2];
    });
    await teardown();
    assert.deepEqual(r, [1, 0]);
  });

  it("destroy() completes subscribers", async () => {
    await setup();
    const completed = await page.evaluate(async () => {
      const { createSharedResizeObserver } = await import("/observers/index.ts");
      const ro = createSharedResizeObserver();
      let completed = 0;
      ro.observe(document.getElementById("el1")!).subscribe({ complete: () => completed++ });
      ro.destroy();
      return completed;
    });
    await teardown();
    assert.equal(completed, 1);
  });
});

describe("useResizeObserver", () => {
  it("calls onResize on real resizes; cleanup stops it; no element is a no-op", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const { useResizeObserver } = await import("/observers/index.ts");
      const el = document.createElement("div");
      el.style.width = "10px";
      document.body.append(el);
      let calls = 0;
      const stop = useResizeObserver({ ref: () => el, onResize: () => calls++ });
      const frame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r)));
      await frame();
      const initial = calls;
      el.style.width = "20px";
      await frame();
      const resized = calls;
      stop();
      el.style.width = "30px";
      await frame();
      useResizeObserver({ ref: null, onResize: () => calls++ })();
      return { initial, resized, after: calls };
    });
    assert.ok(r.initial >= 1, "native observer fires on observe");
    assert.equal(r.resized, r.initial + 1);
    assert.equal(r.after, r.resized);
  });
});
