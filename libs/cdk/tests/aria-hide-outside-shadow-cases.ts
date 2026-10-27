// Ported from react-aria/test/overlays/ariaHideOutside.test.js (shadow DOM cases),
// Apache-2.0, Copyright 2020 Adobe. All rights reserved.
// Changes: React portals become DOM fixtures; Vitest assertions; shared happy-dom / Chromium suite.
// Rivet additions explicitly marked below. All observers are released even after a failed assertion.
import { afterEach, describe, expect, test } from "vitest";
import { ariaHideOutside, type AriaHideOutsideOptions } from "../overlay/aria-hide-outside.ts";

export function shadowHideOutsideCases(): void {
  describe("ariaHideOutside with shadow DOM", () => {
    const releases: (() => void)[] = [];
    const fixtures: Element[] = [];
    const mount = (html = "") => {
      const el = document.createElement("div");
      el.innerHTML = html;
      document.body.append(el);
      fixtures.push(el);
      return el;
    };
    const shadow = (host: Element, html: string) => {
      const root = host.attachShadow({ mode: "open" });
      root.innerHTML = html;
      return root;
    };
    const get = (root: ParentNode, selector: string) => root.querySelector<HTMLElement>(selector)!;
    const hide = (targets: Element[], options?: AriaHideOutsideOptions | Element) => {
      const release = ariaHideOutside(targets, options);
      releases.push(release);
      return release;
    };
    const visible = (...nodes: Element[]) => {
      for (const node of nodes) expect(node.getAttribute("aria-hidden")).not.toBe("true");
    };
    const hidden = (...nodes: Element[]) => {
      for (const node of nodes) expect(node.getAttribute("aria-hidden")).toBe("true");
    };
    const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
    afterEach(() => {
      for (const release of releases.splice(0).reverse()) release();
      for (const fixture of fixtures.splice(0)) fixture.remove();
    });

    test("should hide everything except the provided element [button]", () => {
      const host = mount();
      const root = shadow(host, '<div><input type="checkbox"><button>Button</button><input type="checkbox"></div>');
      hide([get(root, "button")]);
      hidden(...root.querySelectorAll("input"));
      visible(get(root, "button"), host, document.body);
      releases.pop()!();
      visible(...root.querySelectorAll("input"));
    });

    test("should not apply aria-hidden to direct parents of the shadow root", () => {
      const parent = mount("<div></div>");
      const host = parent.firstElementChild!;
      const root = shadow(host, '<div id="modal" role="dialog">Modal Content</div>');
      // Upstream JS passes a ShadowRoot as argument 2. It is not an Element/options
      // object, so the runtime uses document.body. Preserve that compatibility case.
      hide([get(root, "#modal")], root as unknown as AriaHideOutsideOptions);
      visible(parent, host, document.body, get(root, "#modal"));
    });

    test("should correctly apply aria-hidden based on shadow DOM structure", () => {
      const parent = mount("<div></div>");
      const host = parent.firstElementChild!;
      const root = shadow(host, '<div id="modal">Modal Content</div><div id="insideContent">Inside Shadow Content</div>');
      const outside = mount("Outside Content");
      hide([get(root, "#modal")], root as unknown as AriaHideOutsideOptions);
      hidden(get(root, "#insideContent"), outside);
      visible(parent, host, document.body, get(root, "#modal"));
    });

    test("should hide non-direct parent elements like header when modal is in Shadow DOM", () => {
      const header = mount("<header>Header</header>");
      const parent = mount("<div></div>");
      const host = parent.firstElementChild!;
      const root = shadow(host, '<div id="modal">Modal Content</div>');
      hide([get(root, "#modal")]);
      hidden(header);
      visible(parent, host, get(root, "#modal"), document.body);
    });

    test("should handle a modal inside nested Shadow DOM structures and hide sibling content in the outer shadow root", () => {
      const host = mount();
      const outer = shadow(host, '<div id="inner"></div><div id="sibling">Sibling Content</div>');
      const inner = shadow(get(outer, "#inner"), '<div id="modal">Modal Content</div>');
      const outside = mount("Outside Content");
      hide([get(inner, "#modal")], inner as unknown as AriaHideOutsideOptions);
      visible(get(inner, "#modal"), get(outer, "#inner"), host, document.body);
      hidden(outside, get(outer, "#sibling"));
    });

    test("should handle a modal inside deeply nested Shadow DOM structures", () => {
      const host = mount();
      const ancestors: Element[] = [host];
      let current = host;
      for (let i = 0; i < 3; i++) {
        const root = shadow(current, "<div></div>");
        current = root.firstElementChild as HTMLDivElement;
        ancestors.push(current);
      }
      current.innerHTML = '<div id="modal">Modal Content</div>';
      const modal = get(current, "#modal");
      hide([modal]);
      visible(modal, ...ancestors, document.body);
    });

    test("should handle dynamic content added to the shadow DOM after ariaHideOutside is applied", async () => {
      const host = mount();
      const root = shadow(host, '<div id="modal">Modal Content</div>');
      hide([get(root, "#modal")]);
      const extra = document.createElement("div");
      root.append(extra);
      await tick();
      hidden(extra);
      visible(host, get(root, "#modal"), document.body);
      // Rivet addition: release restores the node and disconnects the shadow observer.
      releases.pop()!();
      visible(extra);
      const later = document.createElement("div");
      root.append(later);
      await tick();
      visible(later);
    });

    test("should hide appropriate elements including those in nested shadow roots without targets", () => {
      const p1 = mount('<div id="C1"></div><div id="C2"></div>');
      const p2 = mount('<div id="C3"></div><div id="C4"></div>');
      shadow(get(p2, "#C3"), "<div>Inner Content C3-1</div><div>Inner Content C3-2</div>");
      const root = shadow(get(p2, "#C4"), '<div id="C5"></div><div id="C6"></div>');
      const inner = shadow(get(root, "#C6"), '<div id="modal">Modal Content</div>');
      hide([get(inner, "#modal"), get(p1, "#C1")]);
      visible(get(p1, "#C1"), get(inner, "#modal"), get(p2, "#C4"), p1, p2);
      hidden(get(p1, "#C2"), get(p2, "#C3"), get(root, "#C5"));
    });

    test("should handle input and popup pattern in shadow DOM", () => {
      mount('<div id="C1"></div><div id="C2"></div>');
      const p2 = mount('<div id="C3"></div><div id="C4"></div>');
      const host = get(p2, "#C4");
      const root = shadow(
        host,
        '<div class="unrelated"></div><div class="content"><input id="input"></div><div class="portal"><div id="popup">Popup</div></div>',
      );
      hide([get(root, "#input"), get(root, "#popup")]);
      visible(get(root, "#input"), get(root, "#popup"), get(root, ".content"), get(root, ".portal"), host, p2);
      hidden(get(root, ".unrelated"));
    });

    test("Rivet: observes all enclosing shadow roots only up to the explicit root's tree", async () => {
      const host = mount();
      const outer = shadow(host, '<div id="boundary"><div id="inner"></div></div>');
      const boundary = get(outer, "#boundary");
      const inner = shadow(get(outer, "#inner"), '<div id="modal"></div>');
      hide([get(inner, "#modal")], { root: boundary });
      const outside = document.createElement("div");
      outer.append(outside);
      const inside = document.createElement("div");
      inner.append(inside);
      await tick();
      hidden(inside);
      visible(outside, boundary, host, get(inner, "#modal"));
    });
  });
}
