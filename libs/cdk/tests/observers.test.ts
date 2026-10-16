// Ported from angular/components src/cdk/observers/observe-content.spec.ts (MIT, © Google LLC):
// the cases that use a fake MutationObserverFactory. Real-DOM cases: tests/browser/observers.test.ts.
import { describe, it, beforeEach } from "vitest";
import assert from "node:assert/strict";
import { createContentObserver, observeContent, type ContentObserver, type MutationObserverFactory } from "../observers/index.ts";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const fakeElement = {} as Element;
const fakeRecords = [{ type: "fake" }] as unknown as MutationRecord[];

describe("Observe content directive (observeContent)", () => {
  it("should disconnect the MutationObserver when the directive is disabled", () => {
    let observed = 0;
    let disconnected = 0;
    const factory: MutationObserverFactory = {
      create: () => ({ observe: () => void observed++, disconnect: () => void disconnected++ }),
    };
    const observer = createContentObserver(factory);
    const stop = observeContent(fakeElement, () => {}, { observer });
    assert.equal(observed, 1);
    assert.equal(disconnected, 0);
    stop(); // disabled = true
    assert.equal(observed, 1);
    assert.equal(disconnected, 1);
  });

  describe("debounced", () => {
    let callbacks: MutationCallback[];
    const invokeCallbacks = (args: MutationRecord[]) => callbacks.forEach((callback) => callback(args, {} as MutationObserver));
    let observer: ContentObserver;
    beforeEach(() => {
      callbacks = [];
      observer = createContentObserver({
        create(callback) {
          callbacks.push(callback);
          return { observe: () => {}, disconnect: () => {} };
        },
      });
    });

    it("should debounce the content changes", async () => {
      let calls = 0;
      const stop = observeContent(fakeElement, () => calls++, { observer, debounce: 50 });
      invokeCallbacks(fakeRecords);
      invokeCallbacks(fakeRecords);
      invokeCallbacks(fakeRecords);
      await wait(120);
      assert.equal(calls, 1);
      stop();
    });

    it("coerces the debounce input (string)", async () => {
      let calls = 0;
      const stop = observeContent(fakeElement, () => calls++, { observer, debounce: "30" });
      invokeCallbacks(fakeRecords);
      invokeCallbacks(fakeRecords);
      assert.equal(calls, 0);
      await wait(80);
      assert.equal(calls, 1);
      stop();
    });
  });
});

describe("ContentObserver injectable", () => {
  let callbacks: MutationCallback[];
  let created: number;
  const invokeCallbacks = (args: MutationRecord[]) => callbacks.forEach((callback) => callback(args, {} as MutationObserver));
  let contentObserver: ContentObserver;
  beforeEach(() => {
    callbacks = [];
    created = 0;
    contentObserver = createContentObserver({
      create(callback) {
        created++;
        callbacks.push(callback);
        return { observe: () => {}, disconnect: () => {} };
      },
    });
  });

  it("should trigger the callback when the content of the element changes", () => {
    let calls = 0;
    contentObserver.observe(fakeElement).subscribe(() => calls++);
    assert.equal(calls, 0);
    invokeCallbacks(fakeRecords);
    assert.equal(calls, 1);
  });

  it("should only create one MutationObserver when observing the same element twice", () => {
    let calls = 0;
    const sub1 = contentObserver.observe(fakeElement).subscribe(() => calls++);
    contentObserver.observe(fakeElement).subscribe(() => calls++);
    assert.equal(created, 1);
    invokeCallbacks(fakeRecords);
    assert.equal(calls, 2);
    calls = 0;
    sub1.unsubscribe();
    invokeCallbacks(fakeRecords);
    assert.equal(calls, 1);
  });

  it("accepts a ref accessor; destroy() completes the streams", () => {
    let completed = 0;
    contentObserver.observe(() => fakeElement).subscribe({ complete: () => completed++ });
    contentObserver.destroy();
    assert.equal(completed, 1);
  });

  it("re-creates the observer after the last subscriber left", () => {
    contentObserver.observe(fakeElement).subscribe().unsubscribe();
    contentObserver.observe(fakeElement).subscribe();
    assert.equal(created, 2);
  });
});
