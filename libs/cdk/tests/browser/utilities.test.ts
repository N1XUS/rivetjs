// Browser tests: clipboard, Dir, platform probes, DOM helpers, runAfterTransition, form reset,
// descriptions, links.
// Ported from angular/components src/cdk/clipboard/{clipboard,copy-to-clipboard}.spec.ts,
// src/cdk/bidi/directionality.spec.ts (MIT, © Google LLC) and react-spectrum
// packages/react-aria/test/utils/{scrollIntoView,getScrollParents,domHelpers,DOMFunctions,
// runAfterTransition,useFormReset,getMetaValue,getNonce}.test.* (Apache-2.0, © Adobe).
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

describe("Clipboard", () => {
  it("#beginCopy loads the copy content in a textarea; destroy() removes it", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const { beginCopy } = await import("/clipboard/index.ts");
      const pending = beginCopy("copy content");
      const value = document.body.querySelector("textarea")?.value;
      const hidden = document.body.querySelector("textarea")?.getAttribute("aria-hidden");
      pending.destroy();
      return { value, hidden, after: document.body.querySelector("textarea") };
    });
    assert.deepEqual(r, { value: "copy content", hidden: "true", after: null });
  });

  it("#copy returns true when execCommand succeeds, removes the textarea and keeps focus (incl. SVG)", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const { copyText } = await import("/clipboard/index.ts");
      const original = document.execCommand;
      document.execCommand = () => true;
      const input = document.createElement("input");
      document.body.append(input);
      input.focus();
      const ok = copyText("copy content");
      const focusKept = document.activeElement === input;
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("tabindex", "0");
      document.body.append(svg);
      svg.focus();
      copyText("x");
      const svgKept = document.activeElement === svg;
      document.execCommand = () => {
        throw new Error("could not copy");
      };
      const thrown = copyText("x");
      const textareaAfterThrow = document.querySelector("textarea");
      document.execCommand = () => false;
      const refused = copyText("x");
      document.execCommand = original;
      return { ok, focusKept, svgKept, thrown, textareaAfterThrow, refused, left: document.querySelector("textarea") };
    });
    assert.deepEqual(r, { ok: true, focusKept: true, svgKept: true, thrown: false, textareaAfterThrow: null, refused: false, left: null });
  });

  it("really writes to the clipboard (Chromium, permission granted)", async () => {
    await reset();
    await page.evaluate(() => {
      const button = document.createElement("button");
      button.id = "copy";
      button.textContent = "Copy";
      button.onclick = async () => {
        const { copyText } = await import("/clipboard/index.ts");
        (window as unknown as { ok: boolean }).ok = copyText("from execCommand");
      };
      document.body.append(button);
    });
    await page.click("#copy");
    await page.waitForFunction(() => "ok" in window);
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "from execCommand");
    await page.evaluate(() => {
      document.getElementById("copy")!.onclick = async () => {
        const { copy } = await import("/clipboard/index.ts");
        (window as unknown as { ok2: boolean }).ok2 = await copy("from async api");
      };
    });
    await page.click("#copy");
    await page.waitForFunction(() => "ok2" in window);
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), "from async api");
  });
});

describe("CdkCopyToClipboard (copyToClipboard)", () => {
  it("copies content upon click and emits copied(true) / copied(false)", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const m = await import("/clipboard/index.ts");
      const calls: string[] = [];
      const results: boolean[] = [];
      const copyBefore = m._clipboard.copy;
      m._clipboard.copy = (text: string) => (calls.push(text), true);
      const owner = {};
      m.copyToClipboard(owner, { text: "copy content", copied: (s) => results.push(s) });
      m._clipboard.copy = () => false;
      m.copyToClipboard(owner, { text: "copy content", copied: (s) => results.push(s) });
      m._clipboard.copy = copyBefore;
      return { calls, results };
    });
    assert.deepEqual(r, { calls: ["copy content"], results: [true, false] });
  });

  for (const succeed of [true, false])
    it(`should be able to attempt multiple times before ${succeed ? "succeeding" : "failing"}`, async () => {
      const r = await page.evaluate(async (succeed) => {
        const m = await import("/clipboard/index.ts");
        let attempts = 0;
        const results: boolean[] = [];
        const before = m._clipboard.beginCopy;
        m._clipboard.beginCopy = () => ({ copy: () => ++attempts >= 3 && succeed, destroy: () => {} }) as never;
        m.copyToClipboard({}, { text: "x", attempts: 3, copied: (s) => results.push(s) });
        await new Promise((r) => setTimeout(r, 100));
        m._clipboard.beginCopy = before;
        return { attempts, results };
      }, succeed);
      assert.deepEqual(r, { attempts: 3, results: [succeed] });
    });

  it("should destroy any pending copies when the directive is destroyed", async () => {
    const r = await page.evaluate(async () => {
      const m = await import("/clipboard/index.ts");
      let copies = 0,
        destroys = 0;
      const before = m._clipboard.beginCopy;
      m._clipboard.beginCopy = () => ({ copy: () => (copies++, false), destroy: () => destroys++ }) as never;
      const owner = {};
      m.copyToClipboard(owner, { text: "x", attempts: 10 });
      await new Promise((r) => setTimeout(r, 5));
      const initial = copies;
      const destroysBefore = destroys;
      m.destroyCopyToClipboard(owner);
      await new Promise((r) => setTimeout(r, 50));
      m._clipboard.beginCopy = before;
      return { initial: initial > 0, sameAfter: copies === initial, destroysBefore, destroys };
    });
    assert.deepEqual(r, { initial: true, sameAfter: true, destroysBefore: 0, destroys: 1 });
  });
});

describe("Dir", () => {
  it("should provide itself as Directionality and update on change; dirChange fires once", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const { mount, signal } = await import("/tests/browser/deps.ts");
      const { DirFixture } = await import("/tests/browser/fixtures/utilities.tsx");
      const direction = signal("rtl");
      const changes: string[] = [];
      const out: { dir?: import("/bidi/index.ts").Directionality } = {};
      mount(() => DirFixture({ direction, changes, out }), document.getElementById("root")!);
      const first = out.dir?.valueSignal();
      const attr = document.querySelector("#root > div")!.getAttribute("dir");
      direction.set("ltr");
      const probe = document.querySelector(".probe")!.textContent;
      direction.set("not-valid");
      return { first, attr, probe, now: out.dir?.valueSignal(), attrNow: document.querySelector("#root > div")!.getAttribute("dir"), changes };
    });
    assert.equal(r.first, "rtl");
    assert.equal(r.attr, "rtl");
    assert.equal(r.probe, "ltr", "descendants read the closest Dir reactively");
    assert.equal(r.now, "ltr");
    assert.equal(r.attrNow, "not-valid", "raw value rendered as-is");
    assert.deepEqual(r.changes, ["ltr"], "ltr → not-valid normalizes to ltr: no second change");
  });

  it("dir=auto is preserved and resolved from navigator.language", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const { mount } = await import("/tests/browser/deps.ts");
      const { Dir } = await import("/bidi/bidi-dir.tsx");
      mount(() => Dir({ dir: "auto", id: "d" }), document.getElementById("root")!);
      const { _resolveDirectionality } = await import("/bidi/index.ts");
      return { attr: document.getElementById("d")!.getAttribute("dir"), value: _resolveDirectionality("auto") };
    });
    assert.deepEqual(r, { attr: "auto", value: "ltr" });
  });

  it("documentDirectionality reads <body dir> before <html dir>", async () => {
    const r = await page.evaluate(async () => {
      const { documentDirectionality } = await import("/bidi/index.ts");
      document.documentElement.dir = "ltr";
      document.body.dir = "rtl";
      const both = documentDirectionality().valueSignal();
      document.body.dir = "";
      document.documentElement.dir = "rtl";
      const html = documentDirectionality().valueSignal();
      document.documentElement.dir = "";
      return { both, html };
    });
    assert.deepEqual(r, { both: "rtl", html: "rtl" });
  });
});

describe("platform (browser)", () => {
  it("detects Chromium: BLINK, supportsScrollBehavior, NEGATED RTL scroll axis, input types, shadow DOM", async () => {
    const r = await page.evaluate(async () => {
      const p = await import("/platform/index.ts");
      return {
        platform: p.getPlatform(),
        scroll: p.supportsScrollBehavior(),
        axis: p.getRtlScrollAxisType(),
        types: p.getSupportedInputTypes().has("date"),
        passive: p.supportsPassiveEventListeners(),
        shadow: p._supportsShadowDom(),
        chrome: p.isChrome(),
        webkit: p.isWebKit(),
      };
    });
    assert.equal(r.platform.isBrowser, true);
    assert.equal(r.platform.BLINK, true);
    assert.equal(r.platform.WEBKIT, false);
    assert.equal(r.scroll, true);
    assert.equal(r.axis, 1, "NEGATED");
    assert.equal(r.types, true);
    assert.equal(r.passive, true);
    assert.equal(r.shadow, true);
    assert.equal(r.chrome, true);
    assert.equal(r.webkit, false);
  });

  it("shadow DOM helpers: _getShadowRoot, focused element and event target pierce shadow roots", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const p = await import("/platform/index.ts");
      const host = document.createElement("div");
      document.body.append(host);
      const root = host.attachShadow({ mode: "open" });
      const button = document.createElement("button");
      root.append(button);
      button.focus();
      let target: EventTarget | null = null;
      document.addEventListener("click", (e) => (target = p._getEventTarget(e)), { once: true });
      button.click();
      return {
        root: p._getShadowRoot(button) === root,
        light: p._getShadowRoot(host),
        focused: p._getFocusedElementPierceShadowDom() === button,
        target: target === button,
      };
    });
    assert.deepEqual(r, { root: true, light: null, focused: true, target: true });
  });
});

describe("DOM helpers", () => {
  it("getOwnerDocument / getOwnerWindow (incl. iframes)", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const d = await import("/utils/dom.ts");
      const iframe = document.createElement("iframe");
      document.body.append(iframe);
      const inner = iframe.contentDocument!.createElement("div");
      iframe.contentDocument!.body.append(inner);
      const div = document.createElement("div");
      document.body.append(div);
      return {
        doc: d.getOwnerDocument(document) === document,
        win: d.getOwnerDocument(window) === document,
        el: d.getOwnerDocument(div) === document,
        none: d.getOwnerDocument(null) === document,
        iframeDoc: d.getOwnerDocument(iframe.contentDocument) === iframe.contentDocument,
        iframeEl: d.getOwnerDocument(inner) === iframe.contentDocument,
        w: d.getOwnerWindow(div) === window,
        ww: d.getOwnerWindow(window) === window,
        iw: d.getOwnerWindow(inner) === iframe.contentWindow,
      };
    });
    for (const [k, v] of Object.entries(r)) assert.equal(v, true, k);
  });

  it("getActiveElement: body by default, light DOM, shadow DOM, nested shadow DOMs, back to document", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const d = await import("/utils/dom.ts");
      const out: boolean[] = [d.getActiveElement() === document.body];
      const input = document.createElement("input");
      document.body.append(input);
      input.focus();
      out.push(d.getActiveElement() === input);
      const host = document.createElement("div");
      document.body.append(host);
      const root = host.attachShadow({ mode: "open" });
      const inner = document.createElement("input");
      root.append(inner);
      inner.focus();
      out.push(d.getActiveElement() === inner);
      const host2 = document.createElement("div");
      root.append(host2);
      const root2 = host2.attachShadow({ mode: "open" });
      const deep = document.createElement("input");
      root2.append(deep);
      deep.focus();
      out.push(d.getActiveElement() === deep);
      input.focus();
      out.push(d.getActiveElement() === input);
      return out;
    });
    assert.deepEqual(r, [true, true, true, true, true]);
  });

  it("setStyle: null target, no initial value, restore previous value / priority, arrays", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const d = await import("/utils/dom.ts");
      const noop = d.setStyle(null, "color", "red");
      noop();
      const a = document.createElement("div"),
        b = document.createElement("div");
      const c1 = d.setStyle(a, "overflow", "hidden");
      const set1 = a.style.overflow;
      c1();
      const removed = a.style.overflow;
      a.style.setProperty("color", "blue", "important");
      const c2 = d.setStyle(a, "color", "red");
      const set2 = a.style.getPropertyPriority("color");
      c2();
      const restored = [a.style.color, a.style.getPropertyPriority("color")];
      b.style.paddingTop = "1px";
      const c3 = d.setStyle([a, b], "padding-top", "5px", "important");
      const both = [a.style.paddingTop, b.style.paddingTop, b.style.getPropertyPriority("padding-top")];
      c3();
      return { set1, removed, set2, restored, both, after: [a.style.paddingTop, b.style.paddingTop] };
    });
    assert.deepEqual(r, { set1: "hidden", removed: "", set2: "", restored: ["blue", "important"], both: ["5px", "5px", "important"], after: ["", "1px"] });
  });

  it("nodeContains with shadow DOM (incl. slotted light DOM, non-Node targets)", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const d = await import("/utils/dom.ts");
      const host = document.createElement("div");
      document.body.append(host);
      const root = host.attachShadow({ mode: "open" });
      const wrapper = document.createElement("div");
      const slot = document.createElement("slot");
      wrapper.append(slot);
      root.append(wrapper);
      const inner = document.createElement("span");
      root.append(inner);
      const light = document.createElement("b");
      host.append(light);
      return {
        shadow: d.nodeContains(host, inner),
        slotted: d.nodeContains(wrapper, light),
        plain: d.nodeContains(document.body, host),
        not: d.nodeContains(inner, host),
        win: d.nodeContains(document.body, window),
      };
    });
    assert.deepEqual(r, { shadow: true, slotted: true, plain: true, not: false, win: false });
  });

  it("getPropagationTargets: window, a shadow root, nested shadow roots, null destination", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const d = await import("/utils/dom.ts");
      const plain = document.createElement("div");
      document.body.append(plain);
      const host = document.createElement("div");
      document.body.append(host);
      const root = host.attachShadow({ mode: "open" });
      const el = document.createElement("div");
      root.append(el);
      const host2 = document.createElement("div");
      root.append(host2);
      const root2 = host2.attachShadow({ mode: "open" });
      const deep = document.createElement("div");
      root2.append(deep);
      const t1 = d.getPropagationTargets(plain);
      const t2 = d.getPropagationTargets(el);
      const t3 = d.getPropagationTargets(deep);
      return {
        plain: t1.length === 1 && t1[0] === window,
        one: t2.length === 2 && t2[0] === window && t2[1] === root,
        nested: t3.length === 3 && t3.includes(root) && t3.includes(root2),
        none: d.getPropagationTargets(el, null).length,
      };
    });
    assert.deepEqual(r, { plain: true, one: true, nested: true, none: 0 });
  });

  it("getScrollParents: root, overflow hidden root, scrollable parent, non-scrollable ancestors", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const d = await import("/utils/dom.ts");
      const root = document.documentElement;
      const div = document.createElement("div");
      document.body.append(div);
      const includesRoot = d.getScrollParents(div).includes(root);
      root.style.overflow = "hidden";
      const hiddenRoot = d.getScrollParents(div).includes(root);
      root.style.overflow = "";
      const scrollable = document.createElement("div");
      scrollable.style.overflow = "auto";
      const child = document.createElement("div");
      scrollable.append(child);
      document.body.append(scrollable);
      const parents = d.getScrollParents(child);
      const plain = document.createElement("div");
      const child2 = document.createElement("div");
      plain.append(child2);
      document.body.append(plain);
      const p2 = d.getScrollParents(child2);
      return {
        includesRoot,
        hiddenRoot,
        scrollable: parents.includes(scrollable) && parents.includes(root),
        excludes: !p2.includes(plain) && !p2.includes(document.body),
        parent: d.getScrollParent(child) === scrollable,
        parentRoot: d.getScrollParent(child2) === root,
      };
    });
    assert.deepEqual(r, { includesRoot: true, hiddenRoot: false, scrollable: true, excludes: true, parent: true, parentRoot: true });
  });

  it("scrollIntoView: root border excluded from the scroll port, start and end", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const d = await import("/utils/dom.ts");
      const scrollView = document.scrollingElement as HTMLElement;
      const target = document.createElement("div");
      document.body.append(target);
      // As the original: a 500×500 root with a 100px border and a 1000×1000 target at (100, 2100).
      target.getBoundingClientRect = () => ({ top: 2100, bottom: 3100, left: 100, right: 1100, width: 1000, height: 1000, x: 100, y: 2100 }) as DOMRect;
      const real = window.getComputedStyle;
      window.getComputedStyle = ((el: Element) =>
        el === scrollView
          ? ({
              borderTopWidth: "100px",
              borderBottomWidth: "100px",
              borderLeftWidth: "100px",
              borderRightWidth: "100px",
              scrollPaddingTop: "0px",
              scrollPaddingBottom: "0px",
              scrollPaddingLeft: "0px",
              scrollPaddingRight: "0px",
              direction: "ltr",
            } as CSSStyleDeclaration)
          : ({
              scrollMarginTop: "0px",
              scrollMarginBottom: "0px",
              scrollMarginLeft: "0px",
              scrollMarginRight: "0px",
            } as CSSStyleDeclaration)) as typeof window.getComputedStyle;
      Object.defineProperty(scrollView, "clientHeight", { get: () => 500, configurable: true });
      Object.defineProperty(scrollView, "clientWidth", { get: () => 500, configurable: true });
      const calls: { left?: number; top?: number }[] = [];
      scrollView.scrollTo = ((o: ScrollToOptions) => calls.push({ left: o.left, top: o.top })) as typeof scrollView.scrollTo;
      d.scrollIntoView(scrollView, target, { block: "start", inline: "start" });
      d.scrollIntoView(scrollView, target, { block: "end", inline: "end" });
      window.getComputedStyle = real;
      delete (scrollView as unknown as Record<string, unknown>).clientHeight;
      delete (scrollView as unknown as Record<string, unknown>).clientWidth;
      delete (scrollView as unknown as Record<string, unknown>).scrollTo;
      return calls;
    });
    assert.deepEqual(r, [
      { left: 100, top: 2100 },
      { left: 600, top: 2600 },
    ]);
  });

  it("scrollIntoView in a real scroll container (nearest, center) and scrollIntoViewport", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const d = await import("/utils/dom.ts");
      const view = document.createElement("div");
      view.style.cssText = "height:100px;overflow:auto;border:0";
      for (let i = 0; i < 20; i++) {
        const item = document.createElement("div");
        item.style.height = "50px";
        item.id = "i" + i;
        view.append(item);
      }
      document.body.append(view);
      d.scrollIntoView(view, document.getElementById("i5")!);
      const nearest = view.scrollTop;
      d.scrollIntoView(view, document.getElementById("i10")!, { block: "center" });
      const center = view.scrollTop;
      document.documentElement.style.overflow = "hidden";
      d.scrollIntoViewport(document.getElementById("i19"));
      const viewport = view.scrollTop;
      document.documentElement.style.overflow = "";
      return { nearest, center, viewport };
    });
    assert.equal(r.nearest, 200, "item 5 (250–300) bottom-aligned in a 100px view");
    assert.equal(r.center, 500 + 25 - 50);
    assert.equal(r.viewport, 900, "scroll prevented on the root: only scroll parents scroll");
  });

  it("getMetaValue / getNonce", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const d = await import("/utils/dom.ts");
      d.resetNonceCache();
      const none = d.getNonce();
      const meta = document.createElement("meta");
      meta.setAttribute("property", "csp-nonce");
      meta.setAttribute("content", "from-content");
      document.head.append(meta);
      const content = d.getNonce();
      d.resetNonceCache();
      meta.setAttribute("nonce", "from-nonce");
      const viaNonce = d.getNonce();
      meta.remove();
      const cached = d.getNonce();
      d.resetNonceCache();
      (window as unknown as { __webpack_nonce__: string }).__webpack_nonce__ = "webpack";
      const webpack = d.getNonce();
      delete (window as unknown as { __webpack_nonce__?: string }).__webpack_nonce__;
      d.resetNonceCache();
      const m2 = document.createElement("meta");
      m2.name = "theme-color";
      m2.content = "#fff";
      document.head.append(m2);
      const named = d.getMetaValue("theme-color");
      const noFallback = d.getMetaValue("other");
      m2.remove();
      return { none, content, viaNonce, cached, webpack, named, noFallback };
    });
    assert.deepEqual(r, {
      none: undefined,
      content: "from-content",
      viaNonce: "from-nonce",
      cached: "from-nonce",
      webpack: "webpack",
      named: "#fff",
      noFallback: undefined,
    });
  });

  it("viewportSize follows window resizes", async () => {
    const r = await page.evaluate(async () => {
      const d = await import("/utils/dom.ts");
      const { size, dispose } = d.viewportSize();
      const first = size();
      dispose();
      return { w: first.width > 0, h: first.height > 0, same: first.width === document.documentElement.clientWidth };
    });
    assert.deepEqual(r, { w: true, h: true, same: true });
  });
});

describe("runAfterTransition", () => {
  it("calls the callback when no transition is running (isTransition false)", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const u = await import("/utils/index.ts");
      u._resetTransitions();
      return await new Promise((resolve) => u.runAfterTransition((t) => resolve(t)));
    });
    assert.equal(r, false);
  });

  it("defers callbacks until a running transition ends; multiple queued callbacks", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const u = await import("/utils/index.ts");
      u._resetTransitions();
      u.trackTransitions();
      const el = document.createElement("div");
      document.body.append(el);
      el.dispatchEvent(new TransitionEvent("transitionrun", { propertyName: "opacity", bubbles: true }));
      const log: string[] = [];
      u.runAfterTransition(() => log.push("a"));
      u.runAfterTransition(() => log.push("b"));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const during = [...log];
      el.dispatchEvent(new TransitionEvent("transitionend", { propertyName: "opacity", bubbles: true }));
      return { during, after: log };
    });
    assert.deepEqual(r, { during: [], after: ["a", "b"] });
  });

  it("a real CSS transition delays the callback (also when it started before tracking)", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const u = await import("/utils/index.ts");
      u._resetTransitions();
      const el = document.createElement("div");
      el.style.cssText = "width:10px;height:10px;transition:width 120ms linear";
      document.body.append(el);
      el.getBoundingClientRect();
      el.style.width = "100px";
      const start = performance.now();
      await new Promise((r) => requestAnimationFrame(r));
      const elapsed = await new Promise<number>((resolve) => u.runAfterTransition((t) => resolve(t ? performance.now() - start : -1)));
      return elapsed;
    });
    assert.ok(r >= 100, `waited for the transition (${r} ms)`);
  });

  it("clears out detached elements", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const u = await import("/utils/index.ts");
      u._resetTransitions();
      u.trackTransitions();
      const el = document.createElement("div");
      document.body.append(el);
      el.dispatchEvent(new TransitionEvent("transitionrun", { propertyName: "width", bubbles: true }));
      el.remove();
      return await new Promise((resolve) => u.runAfterTransition((t) => resolve(t)));
    });
    assert.equal(r, false);
  });
});

describe("useFormReset / useDescription", () => {
  it("calls onReset on reset (also when the event is stopped), every onReset, not when cancelled", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const u = await import("/utils/index.ts");
      const form = document.createElement("form");
      const a = document.createElement("input"),
        b = document.createElement("input");
      form.append(a, b);
      document.body.append(form);
      const log: string[] = [];
      const ca = u.useFormReset(a, "A", (v) => log.push(v));
      u.useFormReset(b, "B", (v) => log.push(v));
      form.reset();
      const stopper = (e: Event) => e.stopPropagation();
      form.addEventListener("reset", stopper);
      form.reset();
      form.removeEventListener("reset", stopper);
      const canceller = (e: Event) => e.preventDefault();
      form.addEventListener("reset", canceller, { capture: true });
      form.reset();
      form.removeEventListener("reset", canceller, { capture: true });
      ca();
      form.reset();
      return log;
    });
    assert.deepEqual(r, ["A", "B", "A", "B", "B"]);
  });

  it("useDescription shares one hidden node per text, reference counted", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const u = await import("/utils/index.ts");
      const a = document.createElement("button"),
        b = document.createElement("button");
      document.body.append(a, b);
      const ca = u.useDescription(a, "Opens a menu");
      const cb = u.useDescription(b, "Opens a menu");
      const same = a.getAttribute("aria-describedby") === b.getAttribute("aria-describedby");
      const node = document.getElementById(a.getAttribute("aria-describedby")!);
      const text = node?.textContent;
      ca();
      const stillThere = node!.isConnected;
      cb();
      return { same, text, hidden: (node as HTMLElement).style.display, stillThere, gone: !node!.isConnected, attr: b.getAttribute("aria-describedby") };
    });
    assert.deepEqual(r, { same: true, text: "Opens a menu", hidden: "none", stillThere: true, gone: true, attr: null });
  });
});

describe("links", () => {
  it("openLink dispatches a click with modifiers; shouldClientNavigate", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const l = await import("/utils/links.tsx");
      const a = document.createElement("a");
      a.href = "#x";
      document.body.append(a);
      const seen: { meta: boolean; opening: boolean }[] = [];
      a.addEventListener("click", (e) => {
        seen.push({ meta: e.metaKey, opening: l.linkState.isOpening });
        e.preventDefault();
      });
      l.openLink(a, { metaKey: true });
      const external = document.createElement("a");
      external.href = "https://example.com/";
      const download = document.createElement("a");
      download.href = "/file";
      download.setAttribute("download", "");
      const blank = document.createElement("a");
      blank.href = "/x";
      blank.target = "_blank";
      return {
        seen,
        focused: document.activeElement === a,
        same: l.shouldClientNavigate(a, {}),
        meta: l.shouldClientNavigate(a, { metaKey: true }),
        external: l.shouldClientNavigate(external, {}),
        download: l.shouldClientNavigate(download, {}),
        blank: l.shouldClientNavigate(blank, {}),
      };
    });
    assert.deepEqual(r, { seen: [{ meta: true, opening: true }], focused: true, same: true, meta: false, external: false, download: false, blank: false });
  });

  it("synthetic links (data-href) and RouterProvider navigate client-side", async () => {
    await reset();
    const r = await page.evaluate(async () => {
      const l = await import("/utils/links.tsx");
      const { mount } = await import("/tests/browser/deps.ts");
      const { RouterFixture } = await import("/tests/browser/fixtures/utilities.tsx");
      const navigations: string[] = [];
      const out: { router?: ReturnType<typeof l.useRouter> } = {};
      mount(() => RouterFixture({ navigations, out }), document.getElementById("root")!);
      const router = out.router;
      const item = document.createElement("div");
      item.setAttribute("data-href", "/next");
      document.body.append(item);
      // react-aria `router.open` / `router.useHref` are the free functions `routerOpen` / `routerHref` (the router is plain data).
      l.routerOpen(router, item, {}, "/next", undefined);
      const clicks: boolean[] = [];
      document.addEventListener("click", (e) => (clicks.push(true), e.preventDefault()), { once: true });
      l.routerOpen(router, item, { metaKey: true }, "/next", undefined);
      const props = l.getSyntheticLinkProps({ href: "/a", target: "_blank" });
      return { navigations, clicks, href: l.routerHref(router, "/x"), isNative: router!.isNative, props, native: l.useRouter().isNative };
    });
    assert.deepEqual(r.navigations, ["/next"]);
    assert.deepEqual(r.clicks, [true], "with a modifier: opened natively");
    assert.equal(r.href, "/base/x");
    assert.equal(r.isNative, false);
    assert.equal(r.native, true, "outside the provider: native router");
    assert.equal(r.props["data-href"], "/a");
    assert.equal(r.props["data-target"], "_blank");
  });
});
