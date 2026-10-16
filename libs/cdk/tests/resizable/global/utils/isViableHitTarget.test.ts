// Ported from react-resizable-panels (lib/global/utils/isViableHitTarget.test.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: upstream test kept as is; import specifiers point at libs/cdk/resizable/engine (`.ts`); suite setup (upstream vitest.setup.ts) imported first. Chromium: `:modal` throw mocked in the fallback test.
import "../../setup.ts";
import { afterEach, describe, expect, test, vi } from "vitest";
import { isViableHitTarget } from "../../../../resizable/engine/global/utils/isViableHitTarget.ts";

describe("isViableHitTarget", () => {
  const hitRegion = new DOMRect(0, 0, 10, 10);

  afterEach(() => {
    document.body.innerHTML = "";
  });

  function mockModal(dialog: HTMLDialogElement, modal: boolean) {
    // JSDom supports neither showModal() nor the ":modal" pseudo-class
    const matches = dialog.matches.bind(dialog);
    vi.spyOn(dialog, "matches").mockImplementation((selector) => (selector === ":modal" ? modal : matches(selector)));
  }

  test("allows targets inside of the group", () => {
    const groupElement = document.createElement("div");
    const target = document.createElement("div");
    groupElement.appendChild(target);
    document.body.appendChild(groupElement);

    expect(
      isViableHitTarget({
        axisElement: groupElement,
        hitRegion,
        pointerEventTarget: target,
      }),
    ).toBe(true);
  });

  test("ignores targets inside of a modal dialog that is inside of the group", () => {
    const groupElement = document.createElement("div");
    const dialog = document.createElement("dialog");
    const target = document.createElement("div");
    dialog.appendChild(target);
    groupElement.appendChild(dialog);
    document.body.appendChild(groupElement);

    mockModal(dialog, true);

    expect(
      isViableHitTarget({
        axisElement: groupElement,
        hitRegion,
        pointerEventTarget: target,
      }),
    ).toBe(false);

    // The dialog itself (e.g. its ::backdrop) should also be ignored
    expect(
      isViableHitTarget({
        axisElement: groupElement,
        hitRegion,
        pointerEventTarget: dialog,
      }),
    ).toBe(false);
  });

  test("ignores targets inside of a modal dialog that is outside of the group", () => {
    const groupElement = document.createElement("div");
    const dialog = document.createElement("dialog");
    const target = document.createElement("div");
    dialog.appendChild(target);
    document.body.appendChild(dialog);
    document.body.appendChild(groupElement);

    mockModal(dialog, true);

    expect(
      isViableHitTarget({
        axisElement: groupElement,
        hitRegion,
        pointerEventTarget: target,
      }),
    ).toBe(false);
  });

  test("allows targets inside of a modal dialog that contains the group", () => {
    const dialog = document.createElement("dialog");
    const groupElement = document.createElement("div");
    const target = document.createElement("div");
    groupElement.appendChild(target);
    dialog.appendChild(groupElement);
    document.body.appendChild(dialog);

    mockModal(dialog, true);

    expect(
      isViableHitTarget({
        axisElement: groupElement,
        hitRegion,
        pointerEventTarget: target,
      }),
    ).toBe(true);
  });

  test("allows targets inside of a non-modal dialog that is inside of the group", () => {
    const groupElement = document.createElement("div");
    const dialog = document.createElement("dialog");
    const target = document.createElement("div");
    dialog.appendChild(target);
    groupElement.appendChild(dialog);
    document.body.appendChild(groupElement);

    mockModal(dialog, false);

    expect(
      isViableHitTarget({
        axisElement: groupElement,
        hitRegion,
        pointerEventTarget: target,
      }),
    ).toBe(true);
  });

  test("falls back to previous behavior if the :modal pseudo-class is not supported", () => {
    const groupElement = document.createElement("div");
    const dialog = document.createElement("dialog");
    const target = document.createElement("div");
    dialog.appendChild(target);
    groupElement.appendChild(dialog);
    document.body.appendChild(groupElement);

    // JSDom throws for ":modal" (no mock)
    // Rivet: Chromium supports `:modal` — make it throw like JSDom does
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, "matches").mockImplementation(function (this: Element, selector: string) {
      if (selector.includes(":modal")) throw new SyntaxError(`'${selector}' is not a valid selector`);
      return matches.call(this, selector);
    });
    expect(() => dialog.matches(":modal")).toThrow();

    expect(
      isViableHitTarget({
        axisElement: groupElement,
        hitRegion,
        pointerEventTarget: target,
      }),
    ).toBe(true);
  });
});
