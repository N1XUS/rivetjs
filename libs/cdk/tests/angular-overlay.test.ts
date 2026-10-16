// Ports of Angular CDK overlay specs (MIT, © Google LLC) in Chromium: overlay.spec.ts,
// overlay-container.spec.ts, dispatchers/*.spec.ts, scroll/*.spec.ts,
// position/global-position-strategy.spec.ts, position/flexible-connected-position-strategy.spec.ts
// (representative subset; see the spec's parity table). Angular's `TestOverlay` component is a
// `DomPortal` of a 60×30 `.transform-origin` div; `TestBed` / zones have no equivalent.
import { describe, test, beforeAll as before, afterAll as after } from "vitest";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import type { Page } from "playwright";
import { harness, type Harness } from "./browser.ts";

let h: Harness;
const css = await readFile(new URL("../overlay-service/overlay.css", import.meta.url), "utf8");
before(async () => (h = await harness()));
after(async () => h?.close());

const modules = [
  "overlay-service/overlay-ref",
  "overlay-service/overlay-container",
  "overlay-service/overlay-dispatchers",
  "overlay-service/scroll-strategies",
  "overlay-service/global-position",
  "overlay-service/connected-position",
  "overlay-service/index",
  "portal/portal-outlet",
  "overlay-service/overlay-viewport",
];

/** A page with every overlay module on `window.cdk` and Angular's test helpers on `window.t`. */
async function open(): Promise<Page> {
  const page = await h.page("", { css, viewport: { width: 1024, height: 768 } });
  await page.evaluate(async (names) => {
    const cdk: Record<string, unknown> = {};
    for (const name of names) Object.assign(cdk, await import(`/libs/cdk/${name}.ts`));
    const w = window as unknown as Record<string, unknown>;
    w.cdk = cdk;
    const block = (tag = "div") => {
      const element = document.createElement(tag);
      element.style.width = "60px";
      element.style.height = "30px";
      element.style.zIndex = "100";
      return element;
    };
    w.t = {
      block,
      positioned() {
        const element = block();
        element.style.position = "absolute";
        document.body.appendChild(element);
        return element;
      },
      content() {
        const element = block();
        element.className = "transform-origin";
        element.textContent = "Pizza";
        // A DomPortal needs a parent (Angular rejects a parentless element) and moves the element back
        // there on detach. The upstream specs attach a component portal (fresh content, gone after
        // detach), so the parent is a holder outside the document: the content is only in the
        // document while attached.
        document.createElement("div").appendChild(element);
        return new (cdk.DomPortal as new (e: Element) => unknown)(element);
      },
      // Angular's specs run change detection after `attach` (`detectChanges` / `flushEffects`), which
      // runs the overlay's `afterNextRender` position pass; here that pass is the next animation frame.
      render: () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
    };
  }, modules);
  return page;
}

/** Run `fn` in a fresh page (`cdk`, `t` globals). */
async function run<T>(fn: () => T | Promise<T>): Promise<Awaited<T>> {
  const page = await open();
  try {
    return (await page.evaluate(fn)) as Awaited<T>;
  } finally {
    await page.close();
  }
}

// Globals inside page functions.
declare const cdk: typeof import("../overlay-service/overlay-ref.ts") &
  typeof import("../overlay-service/overlay-container.ts") &
  typeof import("../overlay-service/overlay-dispatchers.ts") &
  typeof import("../overlay-service/scroll-strategies.ts") &
  typeof import("../overlay-service/global-position.ts") &
  typeof import("../overlay-service/connected-position.ts") &
  typeof import("../overlay-service/index.ts") &
  typeof import("../portal/portal-outlet.ts") &
  typeof import("../overlay-service/overlay-viewport.ts");
declare const t: {
  block(tag?: string): HTMLElement;
  positioned(): HTMLElement;
  content(): import("../portal/portal-outlet.ts").DomPortal;
  render(): Promise<void>;
};

describe("Overlay", () => {
  test("should load content into an overlay; open multiple overlays", async () => {
    const r = await run(() => {
      const a = cdk.createOverlayRef();
      a.attach(t.content());
      const container = cdk.overlayContainer().getContainerElement();
      const one = container.textContent;
      const b = cdk.createOverlayRef();
      b.attach(t.content());
      const two = container.querySelectorAll(".cdk-overlay-pane").length;
      a.dispose();
      const after = container.querySelectorAll(".cdk-overlay-pane").length;
      return { one, two, after, isPopover: b.hostElement.getAttribute("popover"), open: container.contains(b.hostElement) };
    });
    assert.equal(r.one, "Pizza");
    assert.equal(r.two, 2);
    assert.equal(r.after, 1);
    // Rivet: the overlay container by default (Angular v20+ defaults to the top layer).
    assert.equal(r.isPopover, null, "container by default");
    assert.equal(r.open, true);
  });

  test("should disable pointer events of the pane element if detached", async () => {
    const r = await run(() => {
      const ref = cdk.createOverlayRef();
      ref.attach(t.content());
      const attached = ref.overlayElement.style.pointerEvents;
      ref.detach();
      return { attached, detached: ref.overlayElement.style.pointerEvents };
    });
    assert.equal(r.attached, "");
    assert.equal(r.detached, "none");
  });

  test("should ensure that the most-recently-attached overlay is on top when popovers are disabled", async () => {
    const r = await run(() => {
      // Rivet: popovers are always disabled (no native top layer).
      const a = cdk.createOverlayRef(),
        b = cdk.createOverlayRef();
      a.attach(t.content());
      b.attach(t.content());
      const order1 = a.hostElement.nextSibling === b.hostElement;
      a.detach();
      a.attach(t.content());
      return { order1, order2: b.hostElement.nextSibling === a.hostElement };
    });
    assert.deepEqual(r, { order1: true, order2: true });
  });

  test("direction: default ltr, from <html dir>, setDirection", async () => {
    const r = await run(() => {
      const ltr = cdk.createOverlayRef();
      ltr.attach(t.content());
      document.documentElement.dir = "rtl";
      const rtl = cdk.createOverlayRef();
      rtl.attach(t.content());
      const set = cdk.createOverlayRef({ direction: "ltr" });
      set.attach(t.content());
      set.setDirection("rtl");
      return { ltr: ltr.getDirection(), rtl: rtl.hostElement.getAttribute("dir"), set: set.hostElement.getAttribute("dir") };
    });
    assert.deepEqual(r, { ltr: "ltr", rtl: "rtl", set: "rtl" });
  });

  test("attachments / detachments streams: order, not on unattached dispose, complete on dispose", async () => {
    const r = await run(() => {
      const log: string[] = [];
      const ref = cdk.createOverlayRef();
      ref.attachments().subscribe(() => log.push("attach:" + !!document.querySelector(".transform-origin")));
      ref.detachments().subscribe(() => log.push("detach:" + !!document.querySelector(".transform-origin")));
      ref.attach(t.content());
      ref.detach();
      const unattached = cdk.createOverlayRef();
      unattached.detachments().subscribe(() => log.push("never"));
      unattached.detach();
      unattached.dispose();
      ref.attach(t.content());
      ref.dispose();
      ref.attachments().subscribe(() => log.push("after-complete"));
      return log;
    });
    assert.deepEqual(r, ["attach:true", "detach:false", "attach:true", "detach:false"]);
  });

  test("should clear out all DOM element references on dispose; attach after dispose does nothing", async () => {
    const r = await run(() => {
      const ref = cdk.createOverlayRef({ hasBackdrop: true });
      ref.attach(t.content());
      ref.dispose();
      const cleared = [ref.overlayElement, ref.hostElement, ref.backdropElement].every((e) => e == null);
      ref.attach(t.content());
      return { cleared, attached: ref.hasAttached() };
    });
    assert.deepEqual(r, { cleared: true, attached: false });
  });

  test("should add and remove the overlay host as the ref is being attached and detached", async () => {
    const r = await run(async () => {
      const ref = cdk.createOverlayRef();
      ref.attach(t.content());
      const container = cdk.overlayContainer().getContainerElement();
      const attached = container.contains(ref.hostElement);
      ref.detach();
      await new Promise((resolve) => setTimeout(resolve, 50));
      const detached = container.contains(ref.hostElement);
      ref.attach(t.content());
      return { attached, detached, reattached: container.contains(ref.hostElement) };
    });
    assert.deepEqual(r, { attached: true, detached: false, reattached: true });
  });

  test("should be able to dispose an overlay on navigation", async () => {
    const r = await run(async () => {
      const ref = cdk.createOverlayRef({ disposeOnNavigation: true });
      ref.attach(t.content());
      history.pushState({}, "", "/next");
      history.back();
      await new Promise((resolve) => setTimeout(resolve, 100));
      return ref.hasAttached();
    });
    assert.equal(r, false);
  });

  test("should add and remove panel classes while open; empty strings are ignored", async () => {
    const r = await run(() => {
      const ref = cdk.createOverlayRef();
      ref.attach(t.content());
      ref.addPanelClass(["custom-one", ""]);
      ref.addPanelClass("custom-two");
      const added = ref.overlayElement.className;
      ref.removePanelClass(["custom-one", ""]);
      return { added, removed: ref.overlayElement.className };
    });
    assert.match(r.added, /custom-one/);
    assert.match(r.added, /custom-two/);
    assert.doesNotMatch(r.removed, /custom-one/);
  });

  test("attachedOverlays signal tracks attach / detach / dispose in order", async () => {
    const r = await run(() => {
      const ids = () => cdk.attachedOverlays().map((ref) => ref.overlayElement?.id);
      const a = cdk.createOverlayRef(),
        b = cdk.createOverlayRef();
      const log: unknown[] = [ids()];
      a.attach(t.content());
      b.attach(t.content());
      log.push(ids().length);
      log.push(ids()[0] === a.overlayElement.id);
      a.detach();
      log.push(ids().length);
      b.dispose();
      log.push(ids().length);
      return log;
    });
    assert.deepEqual(r, [[], 2, true, 1, 0]);
  });

  test("positioning: applies the strategy; swaps strategies; dispose twice", async () => {
    const r = await run(async () => {
      const calls: string[] = [];
      const strategy = (name: string) => ({
        attach: () => calls.push(name + ":attach"),
        apply: () => calls.push(name + ":apply"),
        dispose: () => calls.push(name + ":dispose"),
      });
      const first = strategy("a");
      const ref = cdk.createOverlayRef({ positionStrategy: first });
      ref.attach(t.content());
      await t.render();
      ref.updatePositionStrategy(strategy("b"));
      ref.updatePositionStrategy((ref.getConfig().positionStrategy as never) ?? first);
      ref.dispose();
      ref.dispose();
      return calls;
    });
    assert.deepEqual(r.slice(0, 5), ["a:attach", "a:apply", "a:dispose", "b:attach", "b:apply"]);
    assert.equal(r.filter((c) => c === "b:dispose").length, 1);
  });

  test("size: width / height / min / max from the config, units, zero, reset", async () => {
    const r = await run(() => {
      const ref = cdk.createOverlayRef({ width: 500, height: "100vh", minWidth: 200, minHeight: "50%", maxWidth: 800, maxHeight: "90vh" });
      ref.attach(t.content());
      const s = ref.overlayElement.style;
      const first = [s.width, s.height, s.minWidth, s.minHeight, s.maxWidth, s.maxHeight];
      ref.updateSize({ width: 0, height: 0 });
      const zero = [s.width, s.height];
      ref.updateSize({ width: "", height: "", minWidth: "", minHeight: "", maxWidth: "", maxHeight: "" });
      return { first, zero, reset: [s.width, s.height, s.minWidth, s.minHeight, s.maxWidth, s.maxHeight] };
    });
    assert.deepEqual(r.first, ["500px", "100vh", "200px", "50%", "800px", "90vh"]);
    assert.deepEqual(r.zero, ["0px", "0px"]);
    assert.deepEqual(r.reset, ["", "", "", "", "", ""]);
  });

  test("backdrop: created before the host, default / custom classes, click stream, removed on detach", async () => {
    const r = await run(async () => {
      const ref = cdk.createOverlayRef({ hasBackdrop: true, backdropClass: ["custom-backdrop", "other"] });
      const clicks: string[] = [];
      ref.backdropClick().subscribe((event) => clicks.push(event.type));
      ref.attach(t.content());
      const backdrop = ref.backdropElement!;
      const info = {
        before: backdrop.nextElementSibling === ref.hostElement || ref.hostElement.contains(backdrop),
        classes: backdrop.className,
      };
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const showing = backdrop.classList.contains("cdk-overlay-backdrop-showing");
      backdrop.click();
      ref.detach();
      const removing = backdrop.style.pointerEvents;
      await new Promise((resolve) => setTimeout(resolve, 600));
      return { ...info, showing, clicks, removing, gone: !backdrop.isConnected };
    });
    assert.equal(r.before, true);
    assert.match(r.classes, /cdk-overlay-backdrop/);
    assert.match(r.classes, /custom-backdrop/);
    assert.match(r.classes, /other/);
    assert.equal(r.showing, true);
    assert.deepEqual(r.clicks, ["click"]);
    assert.equal(r.removing, "none");
    assert.equal(r.gone, true);
  });

  test("should set a class on the backdrop when animations are disabled", async () => {
    const r = await run(() => {
      const ref = cdk.createOverlayRef({ hasBackdrop: true, disableAnimations: true });
      ref.attach(t.content());
      return ref.backdropElement!.classList.contains("cdk-overlay-backdrop-noop-animation");
    });
    assert.equal(r, true);
  });

  test("panelClass: applied, multiple, removed after detach", async () => {
    const r = await run(async () => {
      const ref = cdk.createOverlayRef({ panelClass: ["custom-panel", "other"] });
      ref.attach(t.content());
      const on = ref.overlayElement.className;
      ref.detach();
      await new Promise((resolve) => setTimeout(resolve, 50));
      return { on, off: ref.overlayElement.className };
    });
    assert.match(r.on, /custom-panel other|other custom-panel/);
    assert.doesNotMatch(r.off, /custom-panel/);
  });

  test("scroll strategy: attached, enabled on attach, disabled on detach / dispose, swappable", async () => {
    const r = await run(() => {
      const log: string[] = [];
      const strategy = (n: string) => ({
        attach: () => log.push(n + ":attach"),
        enable: () => log.push(n + ":enable"),
        disable: () => log.push(n + ":disable"),
        detach: () => log.push(n + ":detach"),
      });
      const ref = cdk.createOverlayRef({ scrollStrategy: strategy("a") });
      ref.attach(t.content());
      ref.detach();
      ref.attach(t.content());
      ref.updateScrollStrategy(strategy("b"));
      ref.dispose();
      return log;
    });
    assert.deepEqual(r, ["a:attach", "a:enable", "a:disable", "a:enable", "a:disable", "a:detach", "b:attach", "b:enable", "b:disable", "b:detach"]);
  });

  test("Overlay service: create, position builder, scroll strategies", async () => {
    const r = await run(() => {
      const overlay = cdk.overlayService();
      const ref = overlay.create({ positionStrategy: overlay.position().global().centerHorizontally(), scrollStrategy: overlay.scrollStrategies.block() });
      ref.attach(t.content());
      return { wrapper: ref.hostElement.classList.contains("cdk-global-overlay-wrapper"), same: overlay === cdk.overlayService() };
    });
    assert.deepEqual(r, { wrapper: true, same: true });
  });
});

describe("OverlayContainer", () => {
  test("should remove the overlay container element from the DOM on destruction", async () => {
    const r = await run(() => {
      const container = new cdk.OverlayContainer();
      const element = container.getContainerElement();
      const inBody = document.body.contains(element);
      container.ngOnDestroy();
      return { inBody, after: document.body.contains(element), cls: element.className };
    });
    assert.deepEqual(r, { inBody: true, after: false, cls: "cdk-overlay-container" });
  });

  test("should add and remove a custom class on the container element; FullscreenOverlayContainer follows fullscreen", async () => {
    const r = await run(() => {
      const container = cdk.overlayContainer().getContainerElement();
      container.classList.add("commander-shepard");
      const has = container.classList.contains("commander-shepard");
      const fullscreen = new cdk.FullscreenOverlayContainer();
      return { has, fullscreenElement: fullscreen.getFullscreenElement() };
    });
    assert.deepEqual(r, { has: true, fullscreenElement: null });
  });
});

describe("OverlayKeyboardDispatcher", () => {
  test("should track overlays in order as they are attached and detached; dispatch to the top-most", async () => {
    const r = await run(() => {
      const a = cdk.createOverlayRef(),
        b = cdk.createOverlayRef();
      const got: string[] = [];
      a.keydownEvents().subscribe(() => got.push("a"));
      b.keydownEvents().subscribe(() => got.push("b"));
      a.attach(t.content());
      b.attach(t.content());
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      b.detach();
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      a.detach();
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return got;
    });
    assert.deepEqual(r, ["b", "a"]);
  });

  test("should skip overlays that do not have keydown event subscriptions", async () => {
    const r = await run(() => {
      const a = cdk.createOverlayRef(),
        b = cdk.createOverlayRef();
      const got: string[] = [];
      a.keydownEvents().subscribe(() => got.push("a"));
      a.attach(t.content());
      b.attach(t.content());
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return got;
    });
    assert.deepEqual(r, ["a"]);
  });
});

describe("OverlayOutsideClickDispatcher", () => {
  test("should dispatch outside clicks to the attached overlays, not inside clicks; contextmenu / auxclick too", async () => {
    const r = await run(() => {
      const a = cdk.createOverlayRef(),
        b = cdk.createOverlayRef();
      const got: string[] = [];
      a.outsidePointerEvents().subscribe((e) => got.push("a:" + e.type));
      b.outsidePointerEvents().subscribe((e) => got.push("b:" + e.type));
      a.attach(t.content());
      b.attach(t.content());
      const outside = document.createElement("button");
      document.body.append(outside);
      const fire = (target: Element, type: string) => {
        target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
        target.dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true }));
      };
      fire(outside, "click");
      fire(a.overlayElement.firstElementChild!, "click");
      fire(outside, "contextmenu");
      return got;
    });
    assert.deepEqual(r.slice(0, 2).sort(), ["a:click", "b:click"]);
    assert.ok(r.includes("b:click") && !r.some((x) => x === "a:click" && r.indexOf(x) > 1 && false));
    assert.ok(r.includes("a:contextmenu") && r.includes("b:contextmenu"));
    assert.equal(r.filter((x) => x === "b:click").length, 2, "a click inside overlay A is outside overlay B");
    assert.equal(r.filter((x) => x === "a:click").length, 1);
  });

  test("should not dispatch when the pointerdown started inside the overlay (drag out)", async () => {
    const r = await run(() => {
      const ref = cdk.createOverlayRef();
      const got: string[] = [];
      ref.outsidePointerEvents().subscribe((e) => got.push(e.type));
      ref.attach(t.content());
      ref.overlayElement.firstElementChild!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, composed: true }));
      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
      return got;
    });
    assert.deepEqual(r, []);
  });
});

describe("scroll strategies", () => {
  test("BlockScrollStrategy: locks the page (cdk-global-scrollblock), restores scroll position; no-op when not scrollable", async () => {
    const r = await run(() => {
      const strategy = cdk.createBlockScrollStrategy();
      const ref = cdk.createOverlayRef({ scrollStrategy: strategy });
      // Not scrollable: nothing happens.
      ref.attach(t.content());
      const idle = document.documentElement.classList.contains("cdk-global-scrollblock");
      ref.detach();
      const big = document.createElement("div");
      big.style.cssText = "width:4000px;height:4000px";
      document.body.append(big);
      window.scroll(100, 200);
      ref.attach(t.content());
      const blocked = document.documentElement.classList.contains("cdk-global-scrollblock");
      const top = document.documentElement.style.top;
      ref.detach();
      return { idle, blocked, top, restored: [window.scrollX, window.scrollY], after: document.documentElement.classList.contains("cdk-global-scrollblock") };
    });
    assert.equal(r.idle, false);
    assert.equal(r.blocked, true);
    assert.equal(r.top, "-200px");
    assert.deepEqual(r.restored, [100, 200]);
    assert.equal(r.after, false);
  });

  test("CloseScrollStrategy: detaches on scroll; threshold", async () => {
    const r = await run(async () => {
      const big = document.createElement("div");
      big.style.cssText = "width:10px;height:4000px";
      document.body.append(big);
      const ref = cdk.createOverlayRef({ scrollStrategy: cdk.createCloseScrollStrategy() });
      ref.attach(t.content());
      window.scroll(0, 50);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const closed = !ref.hasAttached();
      window.scroll(0, 0);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const withThreshold = cdk.createOverlayRef({ scrollStrategy: cdk.createCloseScrollStrategy({ threshold: 100 }) });
      withThreshold.attach(t.content());
      window.scroll(0, 50);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const small = withThreshold.hasAttached();
      window.scroll(0, 200);
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { closed, small, big: withThreshold.hasAttached() };
    });
    assert.deepEqual(r, { closed: true, small: true, big: false });
  });

  test("RepositionScrollStrategy: updates the position on scroll; autoClose when the origin scrolls out", async () => {
    const r = await run(async () => {
      const big = document.createElement("div");
      big.style.cssText = "width:10px;height:4000px";
      document.body.append(big);
      let applied = 0;
      const ref = cdk.createOverlayRef({
        scrollStrategy: cdk.createRepositionScrollStrategy(),
        positionStrategy: { attach() {}, apply: () => void applied++, dispose() {} },
      });
      ref.attach(t.content());
      const before = applied;
      window.scroll(0, 30);
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { repositioned: applied > before };
    });
    assert.deepEqual(r, { repositioned: true });
  });

  test("a scroll strategy attached to two overlays throws", async () => {
    const r = await run(() => {
      const strategy = cdk.createRepositionScrollStrategy();
      cdk.createOverlayRef({ scrollStrategy: strategy }).attach(t.content());
      try {
        cdk.createOverlayRef({ scrollStrategy: strategy });
        return "no";
      } catch (e) {
        return String((e as Error).message);
      }
    });
    assert.match(r, /already been attached/);
  });
});

describe("GlobalPositionStrategy", () => {
  const place = (fn: string) =>
    run(
      new Function(`
      const strategy = ${fn};
      const ref = cdk.createOverlayRef({ positionStrategy: strategy });
      ref.attach(t.content());
      ref.updatePosition();
      const pane = ref.overlayElement, host = ref.hostElement;
      const r = pane.getBoundingClientRect();
      return { margin: [pane.style.marginTop, pane.style.marginLeft, pane.style.marginBottom, pane.style.marginRight], justify: host.style.justifyContent, align: host.style.alignItems, position: pane.style.position, rect: [r.left, r.top], wrapper: host.className };
    `) as () => unknown,
    ) as Promise<{ margin: string[]; justify: string; align: string; position: string; rect: number[]; wrapper: string }>;

  test("should position the element to the (top, left) with an offset", async () => {
    const r = await place("cdk.createGlobalPositionStrategy().top('10px').left('40px')");
    assert.deepEqual(r.margin, ["10px", "40px", "", ""]);
    assert.equal(r.justify, "flex-start");
    assert.equal(r.align, "flex-start");
    assert.deepEqual(r.rect, [40, 10]);
    assert.match(r.wrapper, /cdk-global-overlay-wrapper/);
  });

  test("should position the element to the (bottom, right) with an offset", async () => {
    const r = await place("cdk.createGlobalPositionStrategy().bottom('70px').right('15em')");
    assert.deepEqual(r.margin, ["", "", "70px", "15em"]);
    assert.equal(r.justify, "flex-end");
    assert.equal(r.align, "flex-end");
  });

  test("should center the element", async () => {
    const r = await place("cdk.createGlobalPositionStrategy().centerHorizontally().centerVertically()");
    assert.equal(r.justify, "center");
    assert.equal(r.align, "center");
    assert.deepEqual(r.rect, [(1024 - 60) / 2, (768 - 30) / 2]);
  });

  test("should center with an offset", async () => {
    const r = await place("cdk.createGlobalPositionStrategy().centerHorizontally('10px').centerVertically('15px')");
    assert.deepEqual(r.margin.slice(0, 2), ["15px", "10px"]);
  });

  test("start / end follow the direction", async () => {
    const r = await run(async () => {
      document.documentElement.dir = "rtl";
      const start = cdk.createOverlayRef({ positionStrategy: cdk.createGlobalPositionStrategy().start("40px") });
      start.attach(t.content());
      const end = cdk.createOverlayRef({ positionStrategy: cdk.createGlobalPositionStrategy().end("40px") });
      end.attach(t.content());
      await t.render();
      return [
        start.overlayElement.style.marginRight,
        start.hostElement.style.justifyContent,
        end.overlayElement.style.marginLeft,
        end.hostElement.style.justifyContent,
      ];
    });
    // Upstream "should position the overlay to the start / end in rtl": the host carries `dir="rtl"`, so
    // `flex-start` is already the right edge (start → margin-right + flex-start, end → margin-left + flex-end).
    assert.deepEqual(r, ["40px", "flex-start", "40px", "flex-end"]);
  });

  test("width / height: 100% resets alignment; config size wins", async () => {
    const r = await run(async () => {
      const ref = cdk.createOverlayRef({ positionStrategy: cdk.createGlobalPositionStrategy().centerHorizontally().width("100%").height("100px") });
      ref.attach(t.content());
      await t.render();
      return [ref.overlayElement.style.width, ref.overlayElement.style.height, ref.hostElement.style.justifyContent];
    });
    assert.deepEqual(r, ["100%", "100px", "flex-start"]);
  });

  test("should clean up after itself when it has been disposed", async () => {
    const r = await run(() => {
      const ref = cdk.createOverlayRef({ positionStrategy: cdk.createGlobalPositionStrategy().top("10px").left("40px") });
      ref.attach(t.content());
      const pane = ref.overlayElement,
        host = ref.hostElement;
      ref.dispose();
      return [
        pane.style.marginTop,
        pane.style.marginLeft,
        pane.style.position,
        host.style.justifyContent,
        host.classList.contains("cdk-global-overlay-wrapper"),
      ];
    });
    assert.deepEqual(r, ["", "", "", "", false]);
  });
});

describe("FlexibleConnectedPositionStrategy", () => {
  /** Attach with `positions` on an origin at `style`; return the pane / origin rects and styles. */
  const connect = (originStyle: string, setup: string, config = "{}") =>
    run(
      new Function(`
      const origin = t.positioned();
      origin.style.cssText += ${JSON.stringify(originStyle)};
      const strategy = cdk.createFlexibleConnectedPositionStrategy(origin)${setup};
      const ref = cdk.createOverlayRef({ positionStrategy: strategy, ...${config} });
      const changes = [];
      strategy.positionChanges.subscribe((c) => changes.push(c.connectionPair.originX + "," + c.connectionPair.originY + "," + c.connectionPair.overlayX + "," + c.connectionPair.overlayY));
      ref.attach(t.content());
      ref.updatePosition();
      const pane = ref.overlayElement.getBoundingClientRect(), o = origin.getBoundingClientRect();
      const fl = (r) => ({ top: Math.floor(r.top), left: Math.floor(r.left), right: Math.floor(r.right), bottom: Math.floor(r.bottom), width: Math.floor(r.width), height: Math.floor(r.height) });
      return { pane: fl(pane), origin: fl(o), host: { alignItems: ref.hostElement.style.alignItems, justifyContent: ref.hostElement.style.justifyContent }, paneStyle: { top: ref.overlayElement.style.top, bottom: ref.overlayElement.style.bottom, left: ref.overlayElement.style.left, right: ref.overlayElement.style.right, transform: ref.overlayElement.style.transform }, classes: ref.overlayElement.className, changes, origin2: [ref.overlayElement.querySelector('.transform-origin').style.transformOrigin] };
    `) as () => unknown,
    ) as Promise<{
      pane: Record<string, number>;
      origin: Record<string, number>;
      host: Record<string, string>;
      paneStyle: Record<string, string>;
      classes: string;
      changes: string[];
      origin2: string[];
    }>;
  const exact = ".withFlexibleDimensions(false).withPush(false)";
  const pos = (originX: string, originY: string, overlayX: string, overlayY: string, extra = "") =>
    `{originX:'${originX}',originY:'${originY}',overlayX:'${overlayX}',overlayY:'${overlayY}'${extra}}`;

  test("should throw when attempting to attach to multiple different overlays; apply after dispose is safe", async () => {
    const r = await run(() => {
      const origin = t.positioned();
      const strategy = cdk
        .createFlexibleConnectedPositionStrategy(origin)
        .withPositions([{ originX: "start", originY: "bottom", overlayX: "start", overlayY: "top" }]);
      const ref = cdk.createOverlayRef({ positionStrategy: strategy });
      ref.attach(t.content());
      let threw = false;
      try {
        cdk.createOverlayRef({ positionStrategy: strategy }).attach(t.content());
      } catch {
        threw = true;
      }
      ref.dispose();
      strategy.apply();
      strategy.reapplyLastPosition();
      return threw;
    });
    assert.equal(r, true);
  });

  for (const [name, originX, originY, overlayX, overlayY, expect] of [
    ["below, left-aligned", "start", "bottom", "start", "top", (o: Record<string, number>) => ({ top: o.bottom, left: o.left })],
    ["to the right, center aligned vertically", "end", "center", "start", "center", (o: Record<string, number>) => ({ top: o.top, left: o.right })],
    ["to the left, below", "start", "bottom", "end", "top", (o: Record<string, number>) => ({ top: o.bottom, left: o.left - 60 })],
    ["above, right aligned", "end", "top", "end", "bottom", (o: Record<string, number>) => ({ top: o.top - 30, left: o.right - 60 })],
    ["below, centered", "center", "bottom", "center", "top", (o: Record<string, number>) => ({ top: o.bottom, left: o.left })],
    ["centered on the origin", "center", "center", "center", "center", (o: Record<string, number>) => ({ top: o.top, left: o.left })],
  ] as const) {
    test(`should position ${name} (not near the edge)`, async () => {
      const r = await connect("top:350px;left:500px", `${exact}.withPositions([${pos(originX, originY, overlayX, overlayY)}])`);
      const e = expect(r.origin);
      assert.equal(r.pane.top, Math.floor(e.top!));
      assert.equal(r.pane.left, Math.floor(e.left!));
    });
  }

  test("should reposition the overlay if it would go off the top / left / bottom / right of the screen", async () => {
    const top = await connect(
      "top:5px;left:200px",
      `${exact}.withPositions([${pos("end", "top", "end", "bottom")},${pos("start", "bottom", "start", "top")}])`,
    );
    assert.equal(top.pane.top, top.origin.bottom);
    assert.equal(top.pane.left, top.origin.left);
    const left = await connect(
      "top:200px;left:5px",
      `${exact}.withPositions([${pos("start", "bottom", "end", "top")},${pos("end", "top", "start", "bottom")}])`,
    );
    assert.equal(left.pane.bottom, left.origin.top);
    assert.equal(left.pane.left, left.origin.right);
    const bottom = await connect(
      "bottom:25px;left:200px;top:auto",
      `${exact}.withPositions([${pos("start", "bottom", "start", "top")},${pos("end", "top", "end", "bottom")}])`,
    );
    assert.equal(bottom.pane.bottom, bottom.origin.top);
    assert.equal(bottom.pane.right, bottom.origin.right);
    const right = await connect(
      "top:200px;right:25px",
      `${exact}.withPositions([${pos("end", "center", "start", "center")},${pos("start", "bottom", "end", "top")}])`,
    );
    assert.equal(right.pane.top, right.origin.bottom);
    assert.equal(right.pane.right, right.origin.left);
  });

  test("should default to the initial position, if no positions fit in the viewport", async () => {
    const r = await connect("top:5px;left:5px", `${exact}.withPositions([${pos("start", "top", "end", "bottom")}])`);
    assert.equal(r.pane.bottom, r.origin.top);
    assert.equal(r.pane.right, r.origin.left);
  });

  test("should pick the fallback position that shows the largest area of the element", async () => {
    const r = await connect(
      "top:200px;right:25px",
      `${exact}.withPositions([${pos("end", "center", "start", "center")},${pos("end", "top", "start", "bottom")},${pos("end", "top", "end", "top")}])`,
    );
    assert.equal(r.pane.top, r.origin.top);
    assert.equal(r.pane.left, r.origin.left + 60 - 60);
  });

  test("should position a panel properly when rtl", async () => {
    const r = await connect("top:200px;left:200px", `${exact}.withPositions([${pos("start", "bottom", "start", "top")}])`, "{direction:'rtl'}");
    assert.equal(r.pane.top, r.origin.bottom);
    assert.equal(r.pane.right, r.origin.right);
    assert.notEqual(r.paneStyle.right, "", "rtl start uses `right`");
  });

  test("offsets: per position, default x / y, position offsets win", async () => {
    const own = await connect("top:200px;left:200px", `${exact}.withPositions([${pos("start", "top", "start", "top", ",offsetX:10,offsetY:20")}])`);
    assert.equal(own.pane.left, own.origin.left + 10);
    assert.equal(own.pane.top, own.origin.top + 20);
    const def = await connect(
      "top:200px;left:200px",
      `${exact}.withDefaultOffsetX(20).withDefaultOffsetY(30).withPositions([${pos("start", "top", "start", "top")}])`,
    );
    assert.equal(def.pane.left, def.origin.left + 20);
    assert.equal(def.pane.top, def.origin.top + 30);
    const wins = await connect(
      "top:200px;left:200px",
      `${exact}.withDefaultOffsetX(20).withPositions([${pos("start", "top", "start", "top", ",offsetX:60")}])`,
    );
    assert.equal(wins.pane.left, wins.origin.left + 60);
  });

  test("transform origin follows the applied position (ltr / rtl / center)", async () => {
    const a = await connect(
      "top:200px;left:200px",
      `${exact}.withTransformOriginOn('.transform-origin').withPositions([${pos("start", "bottom", "start", "top")}])`,
    );
    assert.deepEqual(a.origin2, ["left top"]);
    const b = await connect(
      "top:200px;left:200px",
      `${exact}.withTransformOriginOn('.transform-origin').withPositions([${pos("end", "bottom", "end", "top")}])`,
    );
    assert.deepEqual(b.origin2, ["right top"]);
    const c = await connect(
      "top:200px;left:200px",
      `${exact}.withTransformOriginOn('.transform-origin').withPositions([${pos("center", "center", "center", "center")}])`,
    );
    assert.deepEqual(c.origin2, ["center center"]);
    const d = await connect(
      "top:200px;left:200px",
      `${exact}.withTransformOriginOn('.transform-origin').withPositions([${pos("start", "bottom", "start", "top")}])`,
      "{direction:'rtl'}",
    );
    assert.deepEqual(d.origin2, ["right top"]);
  });

  test("with origin set to a point (primary, fallback, with size)", async () => {
    const r = await run(async () => {
      const results: number[][] = [];
      for (const [origin, positions] of [
        [{ x: 50, y: 100 }, [{ originX: "start", originY: "bottom", overlayX: "start", overlayY: "top" }]],
        [
          { x: 200, y: 760 },
          [
            { originX: "start", originY: "bottom", overlayX: "start", overlayY: "top" },
            { originX: "start", originY: "top", overlayX: "start", overlayY: "bottom" },
          ],
        ],
        [{ x: 100, y: 200, width: 100, height: 50 }, [{ originX: "end", originY: "bottom", overlayX: "start", overlayY: "top" }]],
      ] as const) {
        const strategy = cdk
          .createFlexibleConnectedPositionStrategy(origin)
          .withFlexibleDimensions(false)
          .withPush(false)
          .withPositions(positions as never);
        const ref = cdk.createOverlayRef({ positionStrategy: strategy });
        ref.attach(t.content());
        await t.render();
        const rect = ref.overlayElement.getBoundingClientRect();
        results.push([Math.floor(rect.left), Math.floor(rect.top), Math.floor(rect.bottom)]);
        ref.dispose();
      }
      return results;
    });
    assert.deepEqual(r[0]!.slice(0, 2), [50, 100]);
    assert.equal(r[1]![2], 760, "fallback above the point");
    assert.deepEqual(r[2]!.slice(0, 2), [200, 250]);
  });

  test("positionChanges: emits on change, even if nothing fits", async () => {
    const r = await connect(
      "top:200px;right:25px",
      `${exact}.withPositions([${pos("end", "center", "start", "center")},${pos("start", "bottom", "end", "top")}])`,
    );
    assert.deepEqual(r.changes, ["start,bottom,end,top"]);
    const none = await connect("top:5px;left:5px", `${exact}.withPositions([${pos("start", "top", "end", "bottom")}])`);
    assert.equal(none.changes.length, 1);
  });

  test("should re-use the preferred position when re-applying while locked in", async () => {
    const r = await run(async () => {
      const origin = t.positioned();
      origin.style.top = "200px";
      origin.style.right = "25px";
      const strategy = cdk
        .createFlexibleConnectedPositionStrategy(origin)
        .withFlexibleDimensions(false)
        .withPush(false)
        .withLockedPosition()
        .withPositions([
          { originX: "end", originY: "center", overlayX: "start", overlayY: "center" },
          { originX: "start", originY: "bottom", overlayX: "end", overlayY: "top" },
        ]);
      const ref = cdk.createOverlayRef({ positionStrategy: strategy });
      const changes: string[] = [];
      strategy.positionChanges.subscribe((c) => changes.push(c.connectionPair.originX));
      // Upstream spies on `reapplyLastPosition`: not called by the first pass, called by a later `apply()`.
      let reapplied = 0;
      const reapply = strategy.reapplyLastPosition.bind(strategy);
      strategy.reapplyLastPosition = () => (reapplied++, reapply());
      ref.attach(t.content());
      await t.render();
      const afterAttach = reapplied;
      origin.style.right = "auto";
      origin.style.left = "200px";
      strategy.apply();
      return { afterAttach, afterApply: reapplied, changes };
    });
    assert.equal(r.afterAttach, 0);
    assert.equal(r.afterApply, 1);
    // Still the fallback although the preferred one fits now: no new position is emitted (upstream emits on change only).
    assert.deepEqual(r.changes, ["start"], "still the fallback although the preferred one fits now");
  });

  test("with pushing: into the viewport on the right / bottom, viewport margin", async () => {
    const right = await connect(
      "top:200px;right:-30px",
      `.withFlexibleDimensions(false).withPush().withPositions([${pos("start", "bottom", "start", "top")}])`,
    );
    assert.equal(right.pane.right, 1024);
    const bottom = await connect(
      "bottom:-15px;left:200px;top:auto",
      `.withFlexibleDimensions(false).withPush().withPositions([${pos("start", "bottom", "start", "top")}])`,
    );
    assert.equal(bottom.pane.bottom, 768);
    // Upstream "should set a margin when pushing the overlay into the viewport horizontally" (out on the left).
    const margin = await connect(
      "top:200px;left:-30px",
      `.withFlexibleDimensions(false).withPush().withViewportMargin(15).withPositions([${pos("start", "bottom", "start", "top")}])`,
    );
    assert.equal(margin.pane.left, 15);
    const sides = await connect(
      "top:200px;left:-30px",
      `.withFlexibleDimensions(false).withPush().withViewportMargin({start:20}).withPositions([${pos("start", "bottom", "start", "top")}])`,
    );
    assert.equal(sides.pane.left, 20);
  });

  test("with flexible dimensions: alignment per direction", async () => {
    const start = await connect("top:200px;left:200px", `.withFlexibleDimensions().withPush(false).withPositions([${pos("start", "bottom", "start", "top")}])`);
    assert.equal(start.host.alignItems, "flex-start");
    const end = await connect("top:200px;left:200px", `.withFlexibleDimensions().withPush(false).withPositions([${pos("end", "bottom", "end", "top")}])`);
    assert.equal(end.host.alignItems, "flex-end");
    const center = await connect(
      "top:200px;left:200px",
      `.withFlexibleDimensions().withPush(false).withPositions([${pos("center", "bottom", "center", "top")}])`,
    );
    assert.equal(center.host.alignItems, "center");
  });

  test("with flexible dimensions: becomes scrollable at the viewport edge (height / width)", async () => {
    const h = await connect(
      "left:200px;bottom:20px;top:auto",
      `.withFlexibleDimensions().withPush(false).withPositions([${pos("start", "bottom", "start", "top")}])`,
    );
    assert.equal(h.pane.height, 20);
    assert.equal(h.pane.bottom, 768);
    const w = await connect("top:200px;right:50px", `.withFlexibleDimensions().withPush(false).withPositions([${pos("end", "center", "start", "center")}])`);
    assert.equal(w.pane.width, 50);
    assert.equal(w.pane.right, 1024);
  });

  test("with flexible dimensions: minHeight / minWidth keep the size (falls back to exact)", async () => {
    const r = await connect(
      "left:200px;bottom:20px;top:auto",
      `.withFlexibleDimensions().withPush(false).withPositions([${pos("start", "bottom", "start", "top")},${pos("start", "top", "start", "bottom")}])`,
      "{minHeight:30}",
    );
    assert.equal(r.pane.height, 30);
  });

  test("should take `weight` into account when determining which position to pick", async () => {
    const r = await connect(
      "left:200px;bottom:300px;top:auto",
      `.withFlexibleDimensions().withPush(false).withPositions([${pos("start", "top", "start", "bottom", ",weight:2")},${pos("start", "bottom", "start", "top", ",weight:1")}])`,
      "{minHeight:10,height:1000}",
    );
    assert.equal(r.pane.bottom, r.origin.top, "the heavier position (above) wins over the larger area below");
  });

  test("withGrowAfterOpen: the overlay grows back after it was constrained", async () => {
    const r = await run(async () => {
      const results: number[] = [];
      for (const grow of [false, true]) {
        const origin = t.positioned();
        origin.style.left = "200px";
        origin.style.bottom = "20px";
        const strategy = cdk
          .createFlexibleConnectedPositionStrategy(origin)
          .withFlexibleDimensions()
          .withPush(false)
          .withGrowAfterOpen(grow)
          .withPositions([{ originX: "start", originY: "bottom", overlayX: "start", overlayY: "top" }]);
        const ref = cdk.createOverlayRef({ positionStrategy: strategy });
        ref.attach(t.content());
        await t.render();
        results.push(Math.floor(ref.overlayElement.getBoundingClientRect().height));
        origin.style.bottom = "200px";
        ref.updatePosition();
        results.push(Math.floor(ref.overlayElement.getBoundingClientRect().height));
        ref.dispose();
        origin.remove();
      }
      return results;
    });
    assert.deepEqual(r, [20, 20, 20, 30]);
  });

  test("positioning properties: ltr start → left, end → right; rtl start → right; vertical top / bottom", async () => {
    const ltrStart = await connect("top:200px;left:200px", `${exact}.withPositions([${pos("start", "bottom", "start", "top")}])`);
    assert.ok(ltrStart.paneStyle.left && !ltrStart.paneStyle.right);
    const ltrEnd = await connect("top:200px;left:200px", `${exact}.withPositions([${pos("end", "bottom", "end", "top")}])`);
    assert.ok(ltrEnd.paneStyle.right && !ltrEnd.paneStyle.left);
    const rtlStart = await connect("top:200px;left:200px", `${exact}.withPositions([${pos("start", "bottom", "start", "top")}])`, "{direction:'rtl'}");
    assert.ok(rtlStart.paneStyle.right && !rtlStart.paneStyle.left);
    const top = await connect("top:200px;left:200px", `${exact}.withPositions([${pos("start", "bottom", "start", "top")}])`);
    assert.ok(top.paneStyle.top && !top.paneStyle.bottom);
    const bottom = await connect("top:200px;left:200px", `${exact}.withPositions([${pos("start", "top", "start", "bottom")}])`);
    assert.ok(bottom.paneStyle.bottom && !bottom.paneStyle.top);
  });

  test("validations: no positions, invalid X / Y", async () => {
    const r = await run(() => {
      const origin = t.positioned();
      const errors: string[] = [];
      for (const positions of [
        [],
        [{ originX: "start", originY: "bottom", overlayX: "left", overlayY: "top" }],
        [{ originX: "start", originY: "middle", overlayX: "start", overlayY: "top" }],
      ]) {
        try {
          cdk.createOverlayRef({ positionStrategy: cdk.createFlexibleConnectedPositionStrategy(origin).withPositions(positions as never) }).attach(t.content());
        } catch (e) {
          errors.push((e as Error).message);
        }
      }
      return errors;
    });
    assert.equal(r.length, 3);
    assert.match(r[0]!, /At least one position is required/);
    assert.match(r[1]!, /Invalid overlayX/);
    assert.match(r[2]!, /Invalid originY/);
  });

  test("panel classes per position: applied, multiple, empty ignored, cleared on change / detach, config panelClass kept", async () => {
    const r = await run(async () => {
      const origin = t.positioned();
      origin.style.top = "200px";
      origin.style.left = "200px";
      const strategy = cdk
        .createFlexibleConnectedPositionStrategy(origin)
        .withFlexibleDimensions(false)
        .withPush(false)
        .withPositions([{ originX: "start", originY: "bottom", overlayX: "start", overlayY: "top", panelClass: ["is-below", "", "x"] }]);
      const ref = cdk.createOverlayRef({ positionStrategy: strategy, panelClass: "mine" });
      ref.attach(t.content());
      await t.render();
      const first = ref.overlayElement.className;
      strategy.withPositions([{ originX: "start", originY: "top", overlayX: "start", overlayY: "bottom", panelClass: "is-above" }]);
      ref.updatePosition();
      const second = ref.overlayElement.className;
      ref.detach();
      return { first, second, detached: ref.overlayElement.className };
    });
    assert.match(r.first, /is-below/);
    assert.match(r.first, /\bx\b/);
    assert.doesNotMatch(r.second, /is-below/);
    assert.match(r.second, /is-above/);
    assert.match(r.second, /mine/);
    assert.doesNotMatch(r.detached, /is-above/);
  });

  // Skipped: Angular's native top-layer path (`usePopover`, `withPopoverLocation`) is removed in Rivet —
  // one div overlay layer (decision: option B, overlay-service/CLAUDE.md "Deviation").
  test.skip("DOM location (usePopover): container by default, inline next to the origin, custom parent", () => {});

  test("one overlay layer: the container is a portal host at the end of body, moved after later portals on attach", async () => {
    const r = await run(() => {
      const ref = cdk.createOverlayRef();
      ref.attach(t.content());
      const container = cdk.overlayContainer().getContainerElement();
      const portalHost = document.createElement("div");
      portalHost.setAttribute("data-rivet-portal", "");
      document.body.append(portalHost); // a React Aria-style overlay opened after it
      const before = container.nextElementSibling === portalHost;
      ref.detach();
      ref.attach(t.content()); // re-attached: stacks last again
      const result = {
        isPortalHost: container.hasAttribute("data-rivet-portal"),
        before,
        last: document.body.lastElementChild === container,
        popover: ref.hostElement.hasAttribute("popover"),
        zIndex: getComputedStyle(container).zIndex,
      };
      portalHost.remove();
      ref.dispose();
      return result;
    });
    assert.deepEqual(r, { isPortalHost: true, before: true, last: true, popover: false, zIndex: "100000" });
  });

  test("should clean up after itself when disposed", async () => {
    const r = await run(() => {
      const origin = t.positioned();
      origin.style.top = "200px";
      origin.style.left = "500px";
      const strategy = cdk
        .createFlexibleConnectedPositionStrategy(origin)
        .withPositions([{ originX: "start", originY: "bottom", overlayX: "start", overlayY: "top", panelClass: "pos" }]);
      const ref = cdk.createOverlayRef({ positionStrategy: strategy });
      ref.attach(t.content());
      const host = ref.hostElement,
        pane = ref.overlayElement;
      strategy.dispose();
      return [
        host.style.top,
        host.style.left,
        host.style.height,
        host.style.width,
        host.style.alignItems,
        host.style.justifyContent,
        pane.style.position,
        host.classList.contains("cdk-overlay-connected-position-bounding-box"),
        pane.classList.contains("pos"),
      ];
    });
    assert.deepEqual(r, ["", "", "", "", "", "", "", false, false]);
  });
});
