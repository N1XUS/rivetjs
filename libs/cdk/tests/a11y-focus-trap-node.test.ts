// Ported from angular/components src/cdk/a11y/focus-trap/focus-trap-manager.spec.ts,
// configurable-focus-trap.spec.ts and event-listener-inert-strategy.spec.ts, MIT, © Google LLC.
// Providers → ConfigurableFocusTrapFactory constructor arguments. happy-dom has no layout, so an
// InteractivityChecker whose isVisible() is true stands in (geometry is covered by the Chromium suite).
import "./dom.ts";
import { describe, it, beforeEach, afterEach, vi } from "vitest";
import assert from "node:assert/strict";
import { ConfigurableFocusTrapFactory, EventListenerFocusTrapInertStrategy, FocusTrapManager, type ConfigurableFocusTrap, type FocusTrap, type FocusTrapInertStrategy, type ManagedFocusTrap } from "../a11y/focus-trap.ts";
import { InteractivityChecker } from "../a11y/interactivity-checker.ts";

class VisibleChecker extends InteractivityChecker {
  override isVisible(): boolean {
    return true;
  }
}

class MockManagedFocusTrap implements ManagedFocusTrap {
  _enable() {}
  _disable() {}
  focusInitialElementWhenReady(): Promise<boolean> {
    return Promise.resolve(true);
  }
}

class MockFocusTrapInertStrategy implements FocusTrapInertStrategy {
  preventFocus(_focusTrap: FocusTrap) {}
  allowFocus(_focusTrap: FocusTrap) {}
}

describe("FocusTrapManager", () => {
  let manager: FocusTrapManager;
  beforeEach(() => (manager = new FocusTrapManager()));

  it("Enables a FocusTrap when it is registered", () => {
    const focusTrap = new MockManagedFocusTrap();
    const enable = vi.spyOn(focusTrap, "_enable");
    manager.register(focusTrap);
    assert.equal(enable.mock.calls.length, 1);
  });

  it("Disables a FocusTrap when it is deregistered", () => {
    const focusTrap = new MockManagedFocusTrap();
    const disable = vi.spyOn(focusTrap, "_disable");
    manager.deregister(focusTrap);
    assert.equal(disable.mock.calls.length, 1);
  });

  it("Disables the previous FocusTrap when a new FocusTrap is registered", () => {
    const focusTrap1 = new MockManagedFocusTrap();
    const focusTrap2 = new MockManagedFocusTrap();
    const disable = vi.spyOn(focusTrap1, "_disable");
    manager.register(focusTrap1);
    manager.register(focusTrap2);
    assert.equal(disable.mock.calls.length, 1);
  });

  it("Filters duplicates before registering a new FocusTrap", () => {
    const focusTrap = new MockManagedFocusTrap();
    const disable = vi.spyOn(focusTrap, "_disable");
    manager.register(focusTrap);
    manager.register(focusTrap);
    assert.equal(disable.mock.calls.length, 0);
  });

  // Rivet addition: deregistering the top trap re-enables the previous one.
  it("Re-enables the previous FocusTrap when the active one is deregistered", () => {
    const focusTrap1 = new MockManagedFocusTrap();
    const focusTrap2 = new MockManagedFocusTrap();
    manager.register(focusTrap1);
    manager.register(focusTrap2);
    const enable = vi.spyOn(focusTrap1, "_enable");
    manager.deregister(focusTrap2);
    assert.equal(enable.mock.calls.length, 1);
  });
});

describe("ConfigurableFocusTrap", () => {
  let root: HTMLElement;
  let focusTrap: ConfigurableFocusTrap | undefined;
  function createTrap(inert: FocusTrapInertStrategy, manager = new FocusTrapManager()): ConfigurableFocusTrap {
    root = document.createElement("div");
    root.innerHTML = `<div id="trap"><input><button>SAVE</button></div>`;
    document.body.appendChild(root);
    return (focusTrap = new ConfigurableFocusTrapFactory(inert, new VisibleChecker(), manager, document).create(root.querySelector("#trap") as HTMLElement));
  }
  afterEach(() => {
    focusTrap?.destroy();
    focusTrap = undefined;
    root?.remove();
  });

  describe("with FocusTrapInertStrategy", () => {
    let mockInertStrategy: FocusTrapInertStrategy;
    beforeEach(() => (mockInertStrategy = new MockFocusTrapInertStrategy()));

    it("Calls preventFocus when it is created", () => {
      const preventFocus = vi.spyOn(mockInertStrategy, "preventFocus");
      const allowFocus = vi.spyOn(mockInertStrategy, "allowFocus");
      createTrap(mockInertStrategy);
      assert.equal(preventFocus.mock.calls.length, 1);
      assert.equal(allowFocus.mock.calls.length, 0);
    });

    it("Calls preventFocus when it is enabled", () => {
      const preventFocus = vi.spyOn(mockInertStrategy, "preventFocus");
      createTrap(mockInertStrategy).enabled = true;
      assert.equal(preventFocus.mock.calls.length, 2);
    });

    it("Calls allowFocus when it is disabled", () => {
      const allowFocus = vi.spyOn(mockInertStrategy, "allowFocus");
      createTrap(mockInertStrategy).enabled = false;
      assert.equal(allowFocus.mock.calls.length, 1);
    });
  });

  describe("with FocusTrapManager", () => {
    let manager: FocusTrapManager;
    beforeEach(() => (manager = new FocusTrapManager()));

    it("Registers when it is created", () => {
      const register = vi.spyOn(manager, "register");
      createTrap(new MockFocusTrapInertStrategy(), manager);
      assert.equal(register.mock.calls.length, 1);
    });

    it("Deregisters when it is disabled", () => {
      const deregister = vi.spyOn(manager, "deregister");
      createTrap(new MockFocusTrapInertStrategy(), manager).enabled = false;
      assert.equal(deregister.mock.calls.length, 1);
    });
  });
});

describe("EventListenerFocusTrapInertStrategy", () => {
  let root: HTMLElement;
  let focusTrap: ConfigurableFocusTrap;
  let el: Record<"outside" | "first" | "second" | "trap", HTMLElement>;
  const settle = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));

  beforeEach(async () => {
    root = document.createElement("div");
    root.innerHTML = `<textarea id="outside"></textarea><div id="trap"><input id="first"><button id="second">SAVE</button></div>`;
    document.body.appendChild(root);
    el = { outside: root.querySelector("#outside")!, first: root.querySelector("#first")!, second: root.querySelector("#second")!, trap: root.querySelector("#trap")! };
    focusTrap = new ConfigurableFocusTrapFactory(new EventListenerFocusTrapInertStrategy(), new VisibleChecker(), new FocusTrapManager(), document).create(el.trap);
    await focusTrap.focusFirstTabbableElementWhenReady();
  });
  afterEach(() => {
    focusTrap.destroy();
    root.remove();
  });

  it("refocuses the first FocusTrap element when focus moves outside the FocusTrap", async () => {
    el.outside.focus();
    await settle();
    assert.equal(document.activeElement, el.first, "Expected first focusable element to be focused");
  });

  it("does not intercept focus when focus moves to another element in the FocusTrap", async () => {
    el.second.focus();
    await settle();
    assert.equal(document.activeElement, el.second, "Expected second focusable element to be focused");
  });

  it("should not intercept focus if it moved outside the trap and back in again", async () => {
    el.outside.focus();
    el.second.focus();
    await settle();
    assert.equal(document.activeElement, el.second, "Expected second focusable element to be focused");
  });

  // Rivet addition: focus may move into overlay panes / top-layer content opened from the trap.
  it("does not intercept focus moving into an overlay pane", async () => {
    const pane = document.createElement("div");
    pane.className = "cdk-overlay-pane";
    pane.innerHTML = `<button>in overlay</button>`;
    document.body.appendChild(pane);
    pane.querySelector("button")!.focus();
    await settle();
    assert.equal(document.activeElement, pane.querySelector("button"));
    pane.remove();
  });
});
