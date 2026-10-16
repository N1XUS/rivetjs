// Ported from react-stately (packages/react-stately/test/toast/useToastState.test.js), Apache-2.0, © Adobe.
// Changes: `renderHook(() => useToastState(p))` → `hook(() => createToastState(p))` (owned root, disposed
// after each test); `visibleToasts` is a signal accessor (`visibleToasts()`); `act` is a passthrough
// (signal writes are synchronous); Jest globals from @rivetjs/testing/jest.
// Rivet additions (end of file): owner cleanup unsubscribes, the cold-region document event, Timer.
/*
 * Copyright 2020 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from "@rivetjs/testing/jest";
import { createRoot } from "@rivetjs/reactivity";
import { createToastQueueState, createToastState, ToastQueue, Timer, TOAST_QUEUE_EVENT } from "../state/toast.ts";

const roots: (() => void)[] = [];
function hook<T>(fn: () => T): { current: T } {
  const root = createRoot(() => ({ current: fn() }));
  roots.push(root.dispose);
  return root.value;
}
afterEach(() => {
  for (const dispose of roots.splice(0)) dispose();
});
const act = (fn: () => unknown) => {
  fn();
};

describe("useToastState", () => {
  let newValue = [
    {
      content: "Toast Message",
      props: { timeout: 0 },
    },
  ];

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => jest.runAllTimers());
  });

  it("should add a new toast via add", () => {
    let result = hook(() => createToastState());
    expect(result.current.visibleToasts()).toStrictEqual([]);

    act(() => {
      result.current.add(newValue[0].content, newValue[0].props);
    });
    expect(result.current.visibleToasts()).toHaveLength(1);
    expect(result.current.visibleToasts()[0].content).toBe(newValue[0].content);
    expect(result.current.visibleToasts()[0].timeout).toBe(0);
    expect(result.current.visibleToasts()[0].timer).toBe(undefined);
    expect(result.current.visibleToasts()[0]).toHaveProperty("key");
  });

  it("should add a new toast with a timer", () => {
    let result = hook(() => createToastState());
    expect(result.current.visibleToasts()).toStrictEqual([]);

    act(() => {
      result.current.add("Test", { timeout: 5000 });
    });
    expect(result.current.visibleToasts()).toHaveLength(1);
    expect(result.current.visibleToasts()[0].content).toBe("Test");
    expect(result.current.visibleToasts()[0].timeout).toBe(5000);
    expect(result.current.visibleToasts()[0].timer).not.toBe(undefined);
    expect(result.current.visibleToasts()[0]).toHaveProperty("key");
  });

  it("should be able to add multiple toasts", () => {
    let secondToast = {
      content: "Second Toast",
      props: { timeout: 0 },
    };
    let result = hook(() => createToastState({ maxVisibleToasts: 2 }));
    expect(result.current.visibleToasts()).toStrictEqual([]);

    act(() => {
      result.current.add(newValue[0].content, newValue[0].props);
    });
    expect(result.current.visibleToasts()[0].content).toBe(newValue[0].content);

    act(() => {
      result.current.add(secondToast.content, secondToast.props);
    });
    expect(result.current.visibleToasts().length).toBe(2);
    expect(result.current.visibleToasts()[0].content).toBe(secondToast.content);
    expect(result.current.visibleToasts()[1].content).toBe(newValue[0].content);
  });

  it("should be able to display three toasts and remove the middle toast via timeout then the visible toast", () => {
    let result = hook(() => createToastState({ maxVisibleToasts: 3 }));

    // Add the first toast
    act(() => {
      result.current.add("First Toast", { timeout: 0 });
    });
    expect(result.current.visibleToasts()).toHaveLength(1);
    expect(result.current.visibleToasts()[0].content).toBe("First Toast");

    // Add the second toast
    act(() => {
      result.current.add("Second Toast", { timeout: 1000 });
    });
    expect(result.current.visibleToasts()).toHaveLength(2);
    expect(result.current.visibleToasts()[0].content).toBe("Second Toast");

    result.current.resumeAll();

    // Add the third toast
    act(() => {
      result.current.add("Third Toast", { timeout: 0 });
    });
    expect(result.current.visibleToasts()).toHaveLength(3);
    expect(result.current.visibleToasts()[0].content).toBe("Third Toast");
    expect(result.current.visibleToasts()[1].content).toBe("Second Toast");
    expect(result.current.visibleToasts()[2].content).toBe("First Toast");

    act(() => jest.advanceTimersByTime(500));
    expect(result.current.visibleToasts()).toHaveLength(3);

    act(() => jest.advanceTimersByTime(1000));
    expect(result.current.visibleToasts()).toHaveLength(2);
    expect(result.current.visibleToasts()[0].content).toBe("Third Toast");
    expect(result.current.visibleToasts()[1].content).toBe("First Toast");

    act(() => {
      result.current.close(result.current.visibleToasts()[0].key);
    });
    expect(result.current.visibleToasts().length).toBe(1);
    expect(result.current.visibleToasts()[0].content).toBe("First Toast");
  });

  it("should be able to display one toast, add multiple toasts, and remove the middle not visible one programmatically", () => {
    let result = hook(() => createToastState());

    // Add the first toast
    act(() => {
      result.current.add("First Toast", { timeout: 0 });
    });
    expect(result.current.visibleToasts()).toHaveLength(1);
    expect(result.current.visibleToasts()[0].content).toBe("First Toast");

    let secondToastKey: string | null = null;
    // Add the second toast
    act(() => {
      secondToastKey = result.current.add("Second Toast", { timeout: 0 });
    });
    expect(result.current.visibleToasts()).toHaveLength(1);
    expect(result.current.visibleToasts()[0].content).toBe("Second Toast");

    // Add the third toast
    act(() => {
      result.current.add("Third Toast", { timeout: 0 });
    });
    expect(result.current.visibleToasts()).toHaveLength(1);
    expect(result.current.visibleToasts()[0].content).toBe("Third Toast");

    // Remove a toast that isn't visible
    act(() => {
      result.current.close(secondToastKey!);
    });
    expect(result.current.visibleToasts()).toHaveLength(1);
    expect(result.current.visibleToasts()[0].content).toBe("Third Toast");

    // Remove the visible toast to confirm the middle toast was removed
    act(() => {
      result.current.close(result.current.visibleToasts()[0].key);
    });
    expect(result.current.visibleToasts().length).toBe(1);
    expect(result.current.visibleToasts()[0].content).toBe("First Toast");
  });

  it("should be able to display one toast, add multiple toasts", () => {
    let result = hook(() => createToastState());

    // Add the first toast
    act(() => {
      result.current.add("First Toast", { timeout: 0 });
    });
    expect(result.current.visibleToasts()).toHaveLength(1);
    expect(result.current.visibleToasts()[0].content).toBe("First Toast");

    // Add the second toast
    act(() => {
      result.current.add("Second Toast", { timeout: 0 });
    });
    expect(result.current.visibleToasts()).toHaveLength(1);
    expect(result.current.visibleToasts()[0].content).toBe("Second Toast");

    // Add the third toast
    act(() => {
      result.current.add("Third Toast", { timeout: 0 });
    });
    expect(result.current.visibleToasts()).toHaveLength(1);
    expect(result.current.visibleToasts()[0].content).toBe("Third Toast");
  });

  it("should maintain the toast queue order on close", () => {
    let result = hook(() => createToastState({ maxVisibleToasts: 3 }));

    act(() => {
      result.current.add("First Toast");
    });
    expect(result.current.visibleToasts()).toHaveLength(1);
    expect(result.current.visibleToasts()[0].content).toBe("First Toast");

    act(() => {
      result.current.add("Second Toast");
    });
    expect(result.current.visibleToasts()).toHaveLength(2);
    expect(result.current.visibleToasts()[0].content).toBe("Second Toast");
    expect(result.current.visibleToasts()[1].content).toBe("First Toast");

    act(() => {
      result.current.add("Third Toast");
    });
    expect(result.current.visibleToasts()).toHaveLength(3);
    expect(result.current.visibleToasts()[0].content).toBe("Third Toast");
    expect(result.current.visibleToasts()[1].content).toBe("Second Toast");
    expect(result.current.visibleToasts()[2].content).toBe("First Toast");

    act(() => {
      result.current.close(result.current.visibleToasts()[1].key);
    });
    expect(result.current.visibleToasts()).toHaveLength(2);
    expect(result.current.visibleToasts()[0].content).toBe("Third Toast");
    expect(result.current.visibleToasts()[1].content).toBe("First Toast");
  });

  it("should close a toast", () => {
    let result = hook(() => createToastState());
    act(() => {
      result.current.add(newValue[0].content, newValue[0].props);
    });

    act(() => {
      result.current.close(result.current.visibleToasts()[0].key);
    });
    expect(result.current.visibleToasts()).toStrictEqual([]);
  });

  it("should queue toasts", () => {
    let result = hook(() => createToastState());
    expect(result.current.visibleToasts()).toStrictEqual([]);

    act(() => {
      result.current.add(newValue[0].content, newValue[0].props);
    });
    expect(result.current.visibleToasts()[0].content).toBe(newValue[0].content);

    act(() => {
      result.current.add("Second Toast");
    });
    expect(result.current.visibleToasts().length).toBe(1);
    expect(result.current.visibleToasts()[0].content).toBe("Second Toast");

    act(() => {
      result.current.close(result.current.visibleToasts()[0].key);
    });
    expect(result.current.visibleToasts().length).toBe(1);
    expect(result.current.visibleToasts()[0].content).toBe(newValue[0].content);
  });

  it("should use provided wrapUpdate", () => {
    let wrapUpdate = jest.fn((fn) => fn());

    let result = hook(() => createToastState({ wrapUpdate }));
    expect(result.current.visibleToasts()).toStrictEqual([]);

    act(() => {
      result.current.add(newValue[0].content, newValue[0].props);
    });
    expect(result.current.visibleToasts()[0].content).toBe(newValue[0].content);

    expect(wrapUpdate).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.add("Second Toast");
    });
    expect(result.current.visibleToasts().length).toBe(1);
    expect(result.current.visibleToasts()[0].content).toBe("Second Toast");

    expect(wrapUpdate).toHaveBeenCalledTimes(2);

    act(() => {
      result.current.close(result.current.visibleToasts()[0].key);
    });
    expect(result.current.visibleToasts().length).toBe(1);
    expect(result.current.visibleToasts()[0].content).toBe(newValue[0].content);

    expect(wrapUpdate).toHaveBeenCalledTimes(3);
  });
});

describe("Rivet: createToastQueueState / ToastQueue", () => {
  it("unsubscribes when its owner is disposed", () => {
    const queue = new ToastQueue<string>();
    let state!: ReturnType<typeof createToastQueueState<string>>;
    const { dispose } = createRoot(() => {
      state = createToastQueueState(queue);
    });
    queue.add("a");
    expect(state.visibleToasts().map((t) => t.content)).toEqual(["a"]);
    dispose();
    queue.add("b");
    expect(state.visibleToasts().map((t) => t.content)).toEqual(["a"]);
  });

  it("wakes an unconnected region with a document event while no one subscribes", () => {
    const target = new EventTarget();
    const previous = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = target;
    const seen: unknown[] = [];
    target.addEventListener(TOAST_QUEUE_EVENT, (e) => seen.push((e as CustomEvent).detail));
    try {
      const queue = new ToastQueue<string>({ name: "main" });
      expect(queue.name).toBe("main");
      queue.add("first");
      expect(seen).toEqual([queue]);
      const unsubscribe = queue.subscribe(() => {});
      queue.add("second");
      expect(seen).toHaveLength(1);
      unsubscribe();
      queue.clear();
      expect(seen).toHaveLength(1); // nothing visible: no wake-up
    } finally {
      (globalThis as { document?: unknown }).document = previous;
    }
  });

  it("wakes once per update, with no timed re-dispatch (the resume runtime attaches document listeners before handlers run)", () => {
    jest.useFakeTimers();
    const target = new EventTarget();
    const previous = (globalThis as { document?: unknown }).document;
    (globalThis as { document?: unknown }).document = target;
    let seen = 0;
    try {
      target.addEventListener(TOAST_QUEUE_EVENT, () => seen++);
      const queue = new ToastQueue<string>({ name: "once" });
      queue.add("first");
      expect(seen).toBe(1);
      jest.advanceTimersByTime(5000);
      expect(seen).toBe(1);
    } finally {
      (globalThis as { document?: unknown }).document = previous;
      jest.useRealTimers();
    }
  });

  it("defaults the queue name and maxVisibleToasts like upstream", () => {
    const queue = new ToastQueue<string>();
    expect(queue.name).toBe("default");
    for (let i = 0; i < 5; i++) queue.add(String(i));
    expect(queue.visibleToasts).toHaveLength(5);
  });
});

describe("Rivet: Timer", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("pauses, resumes and fires once even when resumed twice", () => {
    const callback = jest.fn();
    const timer = new Timer(callback, 1000);
    timer.resume();
    timer.resume();
    jest.advanceTimersByTime(400);
    timer.pause();
    jest.advanceTimersByTime(5000);
    expect(callback).not.toHaveBeenCalled();
    timer.resume();
    jest.advanceTimersByTime(599);
    expect(callback).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("reset restarts a running countdown", () => {
    const callback = jest.fn();
    const timer = new Timer(callback, 1000);
    timer.resume();
    jest.advanceTimersByTime(900);
    timer.reset(1000);
    jest.advanceTimersByTime(900);
    expect(callback).not.toHaveBeenCalled();
    jest.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
