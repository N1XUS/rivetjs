// Ported from angular/components src/cdk/a11y/live-announcer/live-announcer.spec.ts, MIT,
// © Google LLC. Injection tokens → constructor options; timers → vi fake timers; CdkAriaLive uses the
// real (happy-dom) MutationObserver instead of a MutationObserverFactory stub.
import "./dom.ts";
import { describe, it, beforeEach, afterEach, vi, type MockInstance } from "vitest";
import assert from "node:assert/strict";
import { LiveAnnouncer, CdkAriaLive, type AriaLivePoliteness } from "../a11y/live-announcer.ts";

function getLiveElement(): Element {
  return document.body.querySelector(".cdk-live-announcer-element")!;
}
const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe("LiveAnnouncer", () => {
  let announcer: LiveAnnouncer;
  let ariaLiveElement: Element;
  const wait = async (ms: number) => {
    vi.advanceTimersByTime(ms);
    await flush();
  };

  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));
  afterEach(() => {
    announcer?.destroy();
    vi.useRealTimers();
  });

  describe("with default element", () => {
    beforeEach(() => {
      announcer = new LiveAnnouncer();
      ariaLiveElement = getLiveElement();
    });

    it("should correctly update the announce text", async () => {
      const button = document.createElement("button");
      button.addEventListener("click", () => void announcer.announce("Test"));
      document.body.appendChild(button);
      button.click();
      await wait(110);
      assert.equal(ariaLiveElement.textContent, "Test");
      button.remove();
    });

    it("should correctly update the politeness attribute", async () => {
      void announcer.announce("Hey Google", "assertive");
      await wait(110);
      assert.equal(ariaLiveElement.textContent, "Hey Google");
      assert.equal(ariaLiveElement.getAttribute("aria-live"), "assertive");
    });

    it("should apply the aria-live value polite by default", async () => {
      void announcer.announce("Hey Google");
      await wait(110);
      assert.equal(ariaLiveElement.textContent, "Hey Google");
      assert.equal(ariaLiveElement.getAttribute("aria-live"), "polite");
    });

    it("should be able to clear out the aria-live element manually", async () => {
      void announcer.announce("Hey Google");
      await wait(110);
      assert.equal(ariaLiveElement.textContent, "Hey Google");
      announcer.clear();
      assert.ok(!ariaLiveElement.textContent);
    });

    it("should be able to clear out the aria-live element by setting a duration", async () => {
      void announcer.announce("Hey Google", 2000);
      await wait(110);
      assert.equal(ariaLiveElement.textContent, "Hey Google");
      await wait(2010);
      assert.ok(!ariaLiveElement.textContent);
    });

    it("should clear the duration of previous messages when announcing a new one", async () => {
      void announcer.announce("Hey Google", 2000);
      await wait(100);
      assert.equal(ariaLiveElement.textContent, "Hey Google");
      void announcer.announce("Hello there");
      await wait(2500);
      assert.equal(ariaLiveElement.textContent, "Hello there");
    });

    it("should remove the aria-live element from the DOM on destroy", async () => {
      void announcer.announce("Hey Google");
      await wait(100);
      announcer.destroy();
      assert.ok(!document.body.querySelector(".cdk-live-announcer-element"), "Expected that the aria-live element was remove from the DOM.");
    });

    it("should return a promise that resolves after the text has been announced", async () => {
      const spy = vi.fn();
      void announcer.announce("something").then(spy);
      assert.equal(spy.mock.calls.length, 0);
      await wait(110);
      assert.equal(spy.mock.calls.length, 1);
    });

    it("should resolve the returned promise if another announcement is made before the timeout has expired", async () => {
      const spy = vi.fn();
      void announcer.announce("something").then(spy);
      await wait(10);
      void announcer.announce("something").then(spy);
      await wait(110);
      assert.equal(spy.mock.calls.length, 2);
    });

    it("should ensure that there is only one live element at a time", async () => {
      announcer.destroy();
      const extraElement = document.createElement("div");
      extraElement.classList.add("cdk-live-announcer-element");
      document.body.appendChild(extraElement);
      announcer = new LiveAnnouncer();
      ariaLiveElement = getLiveElement();
      void announcer.announce("Hey Google");
      await wait(110);
      assert.equal(document.body.querySelectorAll(".cdk-live-announcer-element").length, 1, "Expected only one live announcer element in the DOM.");
      extraElement.remove();
    });

    it("should clear any previous timers when a new one is started", async () => {
      assert.ok(!ariaLiveElement.textContent);
      void announcer.announce("One");
      await wait(50);
      void announcer.announce("Two");
      await wait(75);
      assert.ok(!ariaLiveElement.textContent);
      await wait(100);
      assert.equal(ariaLiveElement.textContent, "Two");
    });

    it("should clear pending timeouts on destroy", async () => {
      void announcer.announce("Hey Google");
      const element = ariaLiveElement;
      announcer.destroy();
      await wait(200);
      assert.ok(!element.textContent);
    });

    function openModal(ariaOwns?: string): HTMLElement {
      const container = document.createElement("div");
      container.className = "cdk-overlay-container";
      const modal = document.createElement("div");
      modal.setAttribute("aria-modal", "true");
      if (ariaOwns) modal.setAttribute("aria-owns", ariaOwns);
      container.appendChild(modal);
      document.body.appendChild(container);
      return modal;
    }

    it("should add aria-owns to open aria-modal elements", async () => {
      const modal = openModal();
      assert.ok(ariaLiveElement.id);
      assert.equal(modal.hasAttribute("aria-owns"), false);
      void announcer.announce("Hey Google", "assertive");
      await wait(110);
      assert.equal(modal.getAttribute("aria-owns"), ariaLiveElement.id);
      void announcer.announce("Hey Google again", "assertive");
      await wait(110);
      assert.equal(modal.getAttribute("aria-owns"), ariaLiveElement.id);
      modal.parentElement!.remove();
    });

    it("should expand aria-owns of open aria-modal elements", async () => {
      const modal = openModal("foo bar");
      assert.ok(ariaLiveElement.id);
      assert.equal(modal.getAttribute("aria-owns"), "foo bar");
      void announcer.announce("Hey Google", "assertive");
      await wait(110);
      assert.equal(modal.getAttribute("aria-owns"), `foo bar ${ariaLiveElement.id}`);
      void announcer.announce("Hey Google again", "assertive");
      await wait(110);
      assert.equal(modal.getAttribute("aria-owns"), `foo bar ${ariaLiveElement.id}`);
      modal.parentElement!.remove();
    });

    // Rivet: Rivet top-layer dialogs count as modals too.
    it("should add aria-owns to aria-modal elements in the Rivet top layer", async () => {
      const modal = document.createElement("div");
      modal.setAttribute("data-rv-top-layer", "");
      modal.setAttribute("aria-modal", "true");
      document.body.appendChild(modal);
      void announcer.announce("Hey", "assertive");
      await wait(110);
      assert.equal(modal.getAttribute("aria-owns"), ariaLiveElement.id);
      modal.remove();
    });

    it.skip("should be able to announce safe HTML", () => {
      // Deviation: messages are text only (no Angular DomSanitizer / SafeHtml).
    });
  });

  describe("with a custom element", () => {
    let customLiveElement: HTMLElement;
    beforeEach(() => {
      customLiveElement = document.createElement("div");
      announcer = new LiveAnnouncer({ liveElement: customLiveElement });
    });

    it("should allow to use a custom live element", async () => {
      void announcer.announce("Custom Element");
      await wait(110);
      assert.equal(customLiveElement.textContent, "Custom Element");
    });
  });

  describe("with a default options", () => {
    beforeEach(() => {
      announcer = new LiveAnnouncer({ politeness: "assertive", duration: 1337 });
      ariaLiveElement = getLiveElement();
    });

    it("should pick up the default politeness from the injection token", async () => {
      void announcer.announce("Hello");
      await wait(2000);
      assert.equal(ariaLiveElement.getAttribute("aria-live"), "assertive");
    });

    it("should pick up the default duration from the injection token", async () => {
      void announcer.announce("Hello");
      await wait(110);
      assert.equal(ariaLiveElement.textContent, "Hello");
      await wait(1500);
      assert.ok(!ariaLiveElement.textContent);
    });
  });
});

describe("CdkAriaLive", () => {
  let announcer: LiveAnnouncer;
  let announce: MockInstance;
  let element: HTMLElement;
  let directive: CdkAriaLive;
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  function setContent(content: string) {
    element.textContent = content;
  }

  beforeEach(() => {
    announcer = new LiveAnnouncer();
    announce = vi.spyOn(announcer, "announce").mockImplementation(() => Promise.resolve());
    element = document.createElement("div");
    element.textContent = "Initial content";
    document.body.appendChild(element);
    directive = new CdkAriaLive(element, "polite", undefined, announcer);
  });
  afterEach(() => {
    directive.destroy();
    element.remove();
    announcer.destroy();
  });

  it("should default politeness to polite", async () => {
    setContent("New content");
    await settle();
    assert.deepEqual(announce.mock.calls.at(-1)!, ["New content", "polite", undefined]);
  });

  it("should dynamically update the politeness", async () => {
    setContent("New content");
    await settle();
    assert.deepEqual(announce.mock.calls.at(-1)!, ["New content", "polite", undefined]);
    announce.mockClear();
    directive.politeness = "off";
    setContent("Newer content");
    await settle();
    assert.equal(announce.mock.calls.length, 0);
    directive.politeness = "assertive" as AriaLivePoliteness;
    setContent("Newest content");
    await settle();
    assert.deepEqual(announce.mock.calls.at(-1)!, ["Newest content", "assertive", undefined]);
  });

  it("should not announce the same text multiple times", async () => {
    setContent("Content");
    await settle();
    assert.equal(announce.mock.calls.length, 1);
    element.setAttribute("data-x", "1");
    setContent("Content");
    await settle();
    assert.equal(announce.mock.calls.length, 1);
  });

  it("should be able to pass in a duration", async () => {
    directive.duration = 1337;
    setContent("New content");
    await settle();
    assert.deepEqual(announce.mock.calls.at(-1)!, ["New content", "polite", 1337]);
  });
});
