// Ported from Angular Components (src/cdk/drag-drop/directives/single-axis-drop-list.spec.ts), MIT, © Google LLC.
// Changes: fixtures from drop-list-fixtures.tsx (same names; instances expose `.element` as the element,
// `item.element.nativeElement` → `item.element`); `fixture.changeDetectorRef.markForCheck()` →
// `fixture.componentInstance.markForCheck()`; `.withContext(m)` → `expect(value, m)`;
// `fixture.whenStable()` → `wait(0)`; Jasmine globals from `@rivetjs/testing/jasmine`.
// Rivet: "layout shift between connected lists" cases test the enter / exit FLIP deviation
// (`drag-drop/dom/layout-shift.ts`; upstream the items jump); "layered styles win over the preview
// resets" tests the resets `<style>` going first in <head> (`drag-drop-registry.ts`); "global preview
// typography" tests the inherited text styles a body-level preview carries (`drag-drop/dom/inherited-text.ts`).
// "replayed press text selection" tests `DragRef._pointerDownFromHost` clearing the selection a cold press started.
import { afterEach, describe, expect, it } from "@rivetjs/testing/jasmine";
import { dispatchMouseEvent } from "@rivetjs/testing/fake-events";
import { createComponent, destroyFixtures, startDraggingViaMouse, wait } from "./drag-test-utils.tsx";
import {
  ConnectedDropZones,
  DraggableInDropZone,
  DraggableInScrollableVerticalDropZone,
  ITEM_HEIGHT,
  ITEM_WIDTH,
  defineCommonDropListTests,
  getHorizontalFixtures,
} from "./drop-list-shared.tsx";

afterEach(() => destroyFixtures());

/** `ConnectedDropZones` side by side (a list's height change does not move the next list). */
class SideBySideConnectedDropZones extends ConnectedDropZones {
  constructor() {
    super();
    this.styles += `.cdk-drop-list { display: inline-block; vertical-align: top; margin-right: 10px; }`;
  }
}

/** ... with the Angular CDK docs' sorting transition on the items. */
class AnimatedConnectedDropZones extends SideBySideConnectedDropZones {
  constructor() {
    super();
    this.styles += `.cdk-drop-list-dragging .cdk-drag:not(.cdk-drag-placeholder) { transition: transform 300ms linear; }`;
  }
}

const SHIFT_ID = "rv-drop-list-shift";
const shiftAnimations = (element: Element) => element.getAnimations().filter((animation) => animation.id === SHIFT_ID).length;
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

describe("Single-axis drop list", () => {
  const { DraggableInHorizontalDropZone } = getHorizontalFixtures("horizontal");

  defineCommonDropListTests({
    verticalListOrientation: "vertical",
    horizontalListOrientation: "horizontal",
    getSortedSiblings: (element, direction) => {
      return element.parentElement
        ? Array.from(element.parentElement.children).sort((a, b) => {
            return a.getBoundingClientRect()[direction] - b.getBoundingClientRect()[direction];
          })
        : [];
    },
  });

  it("should lay out the elements correctly, when swapping down with a taller element", async () => {
    const fixture = createComponent(DraggableInDropZone);
    fixture.detectChanges();

    const items = fixture.componentInstance.dragItems.map((i) => i.element);
    const { top, left } = items[0].getBoundingClientRect();

    fixture.componentInstance.items[0].height = ITEM_HEIGHT * 2;
    fixture.componentInstance.markForCheck();
    fixture.detectChanges();

    startDraggingViaMouse(fixture, items[0], left, top);

    const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;
    const target = items[1];
    const targetRect = target.getBoundingClientRect();

    // Add a few pixels to the top offset so we get some overlap.
    dispatchMouseEvent(document, "mousemove", targetRect.left, targetRect.top + 5);
    fixture.detectChanges();

    expect(placeholder.style.transform).toBe(`translate3d(0px, ${ITEM_HEIGHT}px, 0px)`);
    expect(target.style.transform).toBe(`translate3d(0px, ${-ITEM_HEIGHT * 2}px, 0px)`);

    dispatchMouseEvent(document, "mouseup");
    fixture.detectChanges();
    await wait(0);
  });

  it("should lay out the elements correctly, when swapping up with a taller element", async () => {
    const fixture = createComponent(DraggableInDropZone);
    fixture.detectChanges();

    const items = fixture.componentInstance.dragItems.map((i) => i.element);
    const { top, left } = items[1].getBoundingClientRect();

    fixture.componentInstance.items[1].height = ITEM_HEIGHT * 2;
    fixture.componentInstance.markForCheck();
    fixture.detectChanges();

    startDraggingViaMouse(fixture, items[1], left, top);

    const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;
    const target = items[0];
    const targetRect = target.getBoundingClientRect();

    // Add a few pixels to the top offset so we get some overlap.
    dispatchMouseEvent(document, "mousemove", targetRect.left, targetRect.bottom - 5);
    fixture.detectChanges();

    expect(placeholder.style.transform).toBe(`translate3d(0px, ${-ITEM_HEIGHT}px, 0px)`);
    expect(target.style.transform).toBe(`translate3d(0px, ${ITEM_HEIGHT * 2}px, 0px)`);

    dispatchMouseEvent(document, "mouseup");
    fixture.detectChanges();
    await wait(0);
  });

  it("should lay out elements correctly, when swapping an item with margin", async () => {
    const fixture = createComponent(DraggableInDropZone);
    fixture.detectChanges();

    const items = fixture.componentInstance.dragItems.map((i) => i.element);
    const { top, left } = items[0].getBoundingClientRect();

    fixture.componentInstance.items[0].margin = 12;
    fixture.componentInstance.markForCheck();
    fixture.detectChanges();

    startDraggingViaMouse(fixture, items[0], left, top);

    const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;
    const target = items[1];
    const targetRect = target.getBoundingClientRect();

    // Add a few pixels to the top offset so we get some overlap.
    dispatchMouseEvent(document, "mousemove", targetRect.left, targetRect.top + 5);
    fixture.detectChanges();

    expect(placeholder.style.transform).toBe(`translate3d(0px, ${ITEM_HEIGHT + 12}px, 0px)`);
    expect(target.style.transform).toBe(`translate3d(0px, ${-ITEM_HEIGHT - 12}px, 0px)`);

    dispatchMouseEvent(document, "mouseup");
    fixture.detectChanges();
    await wait(0);
  });

  it("should lay out the elements correctly, when swapping to the right with a wider element", async () => {
    const fixture = createComponent(DraggableInHorizontalDropZone);
    fixture.detectChanges();

    const items = fixture.componentInstance.dragItems.map((i) => i.element);

    fixture.componentInstance.items[0].width = ITEM_WIDTH * 2;
    fixture.componentInstance.markForCheck();
    fixture.detectChanges();

    const { top, left } = items[0].getBoundingClientRect();
    startDraggingViaMouse(fixture, items[0], left, top);

    const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;
    const target = items[1];
    const targetRect = target.getBoundingClientRect();

    dispatchMouseEvent(document, "mousemove", targetRect.right - 5, targetRect.top);
    fixture.detectChanges();

    expect(placeholder.style.transform).toBe(`translate3d(${ITEM_WIDTH}px, 0px, 0px)`);
    expect(target.style.transform).toBe(`translate3d(${-ITEM_WIDTH * 2}px, 0px, 0px)`);

    dispatchMouseEvent(document, "mouseup");
    fixture.detectChanges();
    await wait(0);
  });

  it("should lay out the elements correctly, when swapping left with a wider element", async () => {
    const fixture = createComponent(DraggableInHorizontalDropZone);
    fixture.detectChanges();

    const items = fixture.componentInstance.dragItems.map((i) => i.element);
    const { top, left } = items[1].getBoundingClientRect();

    fixture.componentInstance.items[1].width = ITEM_WIDTH * 2;
    fixture.componentInstance.markForCheck();
    fixture.detectChanges();

    startDraggingViaMouse(fixture, items[1], left, top);

    const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;
    const target = items[0];
    const targetRect = target.getBoundingClientRect();

    dispatchMouseEvent(document, "mousemove", targetRect.right - 5, targetRect.top);
    fixture.detectChanges();

    expect(placeholder.style.transform).toBe(`translate3d(${-ITEM_WIDTH}px, 0px, 0px)`);
    expect(target.style.transform).toBe(`translate3d(${ITEM_WIDTH * 2}px, 0px, 0px)`);

    dispatchMouseEvent(document, "mouseup");
    fixture.detectChanges();
    await wait(0);
  });

  it("should clear the `transform` value from siblings when item is dropped", async () => {
    const fixture = createComponent(DraggableInDropZone);
    fixture.detectChanges();

    const dragItems = fixture.componentInstance.dragItems;
    const firstItem = dragItems.first;
    const thirdItem = dragItems.toArray()[2].element;
    const thirdItemRect = thirdItem.getBoundingClientRect();

    startDraggingViaMouse(fixture, firstItem.element);

    dispatchMouseEvent(document, "mousemove", thirdItemRect.left + 1, thirdItemRect.top + 1);
    fixture.detectChanges();

    expect(thirdItem.style.transform).toBeTruthy();

    dispatchMouseEvent(document, "mouseup");
    fixture.detectChanges();
    await wait(0);
    fixture.detectChanges();

    expect(thirdItem.style.transform).toBeFalsy();
  });

  it("should lay out elements correctly, when horizontally swapping an item with margin", async () => {
    const fixture = createComponent(DraggableInHorizontalDropZone);
    fixture.detectChanges();

    const items = fixture.componentInstance.dragItems.map((i) => i.element);
    const { top, left } = items[0].getBoundingClientRect();

    fixture.componentInstance.items[0].margin = 12;
    fixture.componentInstance.markForCheck();
    fixture.detectChanges();

    startDraggingViaMouse(fixture, items[0], left, top);

    const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;
    const target = items[1];
    const targetRect = target.getBoundingClientRect();

    dispatchMouseEvent(document, "mousemove", targetRect.right - 5, targetRect.top);
    fixture.detectChanges();

    expect(placeholder.style.transform).toBe(`translate3d(${ITEM_WIDTH + 12}px, 0px, 0px)`);
    expect(target.style.transform).toBe(`translate3d(${-ITEM_WIDTH - 12}px, 0px, 0px)`);

    dispatchMouseEvent(document, "mouseup");
    fixture.detectChanges();
    await wait(0);
  });

  it("should preserve the original `transform` of items in the list", async () => {
    const fixture = createComponent(DraggableInScrollableVerticalDropZone);
    fixture.detectChanges();
    const items = fixture.componentInstance.dragItems.map((item) => item.element);
    items.forEach((element) => (element.style.transform = "rotate(180deg)"));
    const thirdItemRect = items[2].getBoundingClientRect();
    const hasInitialTransform = (element: HTMLElement) => element.style.transform.indexOf("rotate(180deg)") > -1;

    startDraggingViaMouse(fixture, items[0]);
    fixture.detectChanges();
    const preview = document.querySelector(".cdk-drag-preview") as HTMLElement;
    const placeholder = fixture.nativeElement.querySelector(".cdk-drag-placeholder") as HTMLElement;

    expect(items.every(hasInitialTransform), "Expected items to preserve transform when dragging starts.").toBe(true);
    expect(hasInitialTransform(preview), "Expected preview to preserve transform when dragging starts.").toBe(true);
    expect(hasInitialTransform(placeholder), "Expected placeholder to preserve transform when dragging starts.").toBe(true);

    dispatchMouseEvent(document, "mousemove", thirdItemRect.left + 1, thirdItemRect.top + 1);
    fixture.detectChanges();
    expect(items.every(hasInitialTransform), "Expected items to preserve transform while dragging.").toBe(true);
    expect(hasInitialTransform(preview), "Expected preview to preserve transform while dragging.").toBe(true);
    expect(hasInitialTransform(placeholder), "Expected placeholder to preserve transform while dragging.").toBe(true);

    dispatchMouseEvent(document, "mouseup");
    fixture.detectChanges();
    await wait(0);
    fixture.detectChanges();
    expect(items.every(hasInitialTransform), "Expected items to preserve transform when dragging stops.").toBe(true);
    expect(hasInitialTransform(preview), "Expected preview to preserve transform when dragging stops.").toBe(true);
    expect(hasInitialTransform(placeholder), "Expected placeholder to preserve transform when dragging stops.").toBe(true);
  });

  it("should enter as last child if entering from top in reversed container", async () => {
    const fixture = createComponent(ConnectedDropZones);

    // Make sure there"s only one item in the first list.
    fixture.componentInstance.todo = ["things"];
    fixture.detectChanges();

    const groups = fixture.componentInstance.groupedDragItems;
    const dropZones = fixture.componentInstance.dropInstances.map((d) => d.element);
    const item = groups[0][0];

    // Add some initial padding as the target drop zone
    const targetDropZoneStyle = dropZones[1].style;
    targetDropZoneStyle.paddingTop = "10px";
    targetDropZoneStyle.display = "flex";
    targetDropZoneStyle.flexDirection = "column-reverse";

    const targetRect = dropZones[1].getBoundingClientRect();

    startDraggingViaMouse(fixture, item.element);

    const placeholder = dropZones[0].querySelector(".cdk-drag-placeholder")!;

    expect(placeholder).toBeTruthy();

    expect(dropZones[0].contains(placeholder), "Expected placeholder to be inside the first container.").toBe(true);

    dispatchMouseEvent(document, "mousemove", targetRect.left, targetRect.top);
    fixture.detectChanges();

    expect(dropZones[1].lastChild === placeholder, "Expected placeholder to be last child inside second container.").toBe(true);

    dispatchMouseEvent(document, "mouseup");
  });

  it("should lay out the elements correctly when scaled", async () => {
    const fixture = createComponent(DraggableInDropZone);
    fixture.componentInstance.scale = 0.5;
    fixture.detectChanges();

    const items = fixture.componentInstance.dragItems.map((i) => i.element);
    const { top, left } = items[0].getBoundingClientRect();

    startDraggingViaMouse(fixture, items[0], left, top);

    const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;
    const target = items[1];
    const targetRect = target.getBoundingClientRect();

    dispatchMouseEvent(document, "mousemove", targetRect.left, targetRect.top + 5);
    fixture.detectChanges();

    expect(placeholder.style.transform).toBe(`translate3d(0px, ${ITEM_HEIGHT * 2}px, 0px)`);
    expect(target.style.transform).toBe(`translate3d(0px, ${-ITEM_HEIGHT * 2}px, 0px)`);

    dispatchMouseEvent(document, "mouseup");
    fixture.detectChanges();
    await wait(0);
  });
  it("should let an app's layered styles win over the preview resets (Rivet: resets layer declared first)", async () => {
    // An app stylesheet in <head> that declares its own cascade layers before the first drag (Tailwind v4).
    document.querySelectorAll("style[data-cdk-drag-resets]").forEach((style) => style.remove());
    const app = document.createElement("style");
    app.textContent = "@layer base, utilities; @layer utilities { .layered-item { padding: 7px; border: 2px solid rgb(4, 5, 6); } }";
    document.head.appendChild(app);
    try {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.get(0)!.element;
      item.classList.add("layered-item");
      const { left, top } = item.getBoundingClientRect();
      startDraggingViaMouse(fixture, item, left, top);

      const preview = document.querySelector(".cdk-drag-preview") as HTMLElement;
      const style = getComputedStyle(preview);
      expect(style.paddingTop).toBe("7px");
      expect(style.borderTopColor).toBe("rgb(4, 5, 6)");
      expect(style.borderTopWidth).toBe("2px");
      // The resets still apply where the app sets nothing (the popover user-agent styles).
      expect(style.overflow).toBe("visible");

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
    } finally {
      app.remove();
    }
  });

  describe("global preview typography (Rivet: inherited text styles carried from the source)", () => {
    const TEXT = ["fontSize", "lineHeight", "fontWeight", "fontFamily", "fontStyle", "letterSpacing", "color", "textTransform"] as const;
    const typography = (element: Element) => {
      const style = getComputedStyle(element);
      return Object.fromEntries(TEXT.map((property) => [property, style[property]]));
    };
    /** Item text: a plain text run (inherits everything) + a child with its own font size (inherits the rest). */
    const decorate = (item: HTMLElement) => {
      const small = document.createElement("small");
      small.style.fontSize = "10px";
      small.textContent = "meta";
      item.appendChild(small);
      return small;
    };
    const styleList = (list: HTMLElement) => {
      Object.assign(list.style, {
        fontSize: "13px",
        lineHeight: "1.5",
        fontWeight: "600",
        fontFamily: "monospace",
        fontStyle: "italic",
        letterSpacing: "1px",
        color: "rgb(1, 2, 3)",
        textTransform: "uppercase",
      });
    };
    const drop = async (fixture: ReturnType<typeof createComponent>) => {
      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
    };

    it("should give the preview the text styles the dragged element inherits from its list", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.get(0)!.element;
      styleList(item.parentElement!);
      const small = decorate(item);
      const expectedRoot = typography(item);
      const expectedSmall = typography(small);
      expect(expectedRoot.fontSize).not.toBe(getComputedStyle(document.body).fontSize);

      const { left, top } = item.getBoundingClientRect();
      startDraggingViaMouse(fixture, item, left, top);
      const preview = document.querySelector(".cdk-drag-preview") as HTMLElement;
      expect(preview.parentNode).toBe(document.body);
      expect(typography(preview)).toEqual(expectedRoot);
      // The unitless line height stays a factor: the 10px child gets 15px, not the list's 19.5px.
      expect(typography(preview.querySelector("small")!)).toEqual(expectedSmall);
      expect(expectedSmall.lineHeight).toBe("15px");
      await drop(fixture);
    });

    it("should let the element's own classes and preview styles win over the carried values", async () => {
      document.querySelectorAll("style[data-cdk-drag-resets]").forEach((style) => style.remove());
      const app = document.createElement("style");
      app.textContent = "@layer utilities { .own-text { font-size: 18px; } } .cdk-drag-preview { letter-spacing: 3px; }";
      document.head.appendChild(app);
      try {
        const fixture = createComponent(DraggableInDropZone);
        fixture.detectChanges();
        const item = fixture.componentInstance.dragItems.get(0)!.element;
        styleList(item.parentElement!);
        item.classList.add("own-text");
        const { left, top } = item.getBoundingClientRect();
        startDraggingViaMouse(fixture, item, left, top);
        const style = getComputedStyle(document.querySelector(".cdk-drag-preview")!);
        expect(style.fontSize).toBe("18px");
        expect(style.letterSpacing).toBe("3px");
        expect(style.fontWeight).toBe("600");
        await drop(fixture);
      } finally {
        app.remove();
      }
    });

    it("should leave a preview in another container to that container's inheritance", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const previewContainer = fixture.componentInstance.alternatePreviewContainer;
      const container = previewContainer.nativeElement as HTMLElement;
      container.style.fontSize = "21px";
      fixture.componentInstance.previewContainer = previewContainer;
      fixture.componentInstance.markForCheck();
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.get(0)!.element;
      styleList(item.parentElement!);
      startDraggingViaMouse(fixture, item);
      const preview = document.querySelector(".cdk-drag-preview") as HTMLElement;
      expect(preview.parentNode).toBe(container);
      expect(getComputedStyle(preview).fontSize).toBe("21px");
      await drop(fixture);
    });
  });

  describe("replayed press text selection (Rivet: cold press handled after its dispatch)", () => {
    const selectItemText = (item: HTMLElement) => {
      const range = document.createRange();
      range.selectNodeContents(item);
      getSelection()!.removeAllRanges();
      getSelection()!.addRange(range);
      expect(String(getSelection())).not.toBe("");
    };

    it("should clear the selection the original press started and restore native interactions after the drop", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.get(0)!;
      const element = item.element;
      const { left, top } = element.getBoundingClientRect();
      // The press reached the page before the code loaded: its dispatch is over (eventPhase NONE)
      // and the browser started a selection meanwhile.
      const press = new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0, buttons: 1, detail: 1, clientX: left, clientY: top });
      expect(press.eventPhase).toBe(Event.NONE);
      selectItemText(element);

      item._dragRef._pointerDownFromHost(press, 100);
      expect(String(getSelection())).toBe("");
      dispatchMouseEvent(document, "mousemove", left, top + 20);
      fixture.detectChanges();
      expect(element.style.userSelect).toBe("none");

      dispatchMouseEvent(document, "mouseup", left, top + 20);
      fixture.detectChanges();
      await wait(0);
      expect(element.style.userSelect).toBe("");
      expect(String(getSelection())).toBe("");
    });

    it("should leave the selection alone for a press handled during its dispatch", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const items = fixture.componentInstance.dragItems.map((i) => i.element);
      selectItemText(items[1]);
      const selected = String(getSelection());
      dispatchMouseEvent(items[0], "mousedown");
      fixture.detectChanges();
      expect(String(getSelection())).toBe(selected);
      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
      getSelection()!.removeAllRanges();
    });
  });

  describe("layout shift between connected lists", () => {
    it("should animate the receiving list's items out of the way of the placeholder", async () => {
      const fixture = createComponent(AnimatedConnectedDropZones);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const item = groups[0][1].element;
      const sibling = groups[1][0].element;
      const before = sibling.getBoundingClientRect().top;
      const { left, top } = item.getBoundingClientRect();

      startDraggingViaMouse(fixture, item, left, top);
      dispatchMouseEvent(document, "mousemove", sibling.getBoundingClientRect().left + 1, before + 1);
      fixture.detectChanges();

      const placeholder = document.querySelector(".cdk-drag-placeholder")!;
      expect(placeholder.nextElementSibling, "Expected the placeholder to enter in front of the sibling.").toBe(sibling);
      // The animation starts after the engine finished the move (microtask).
      await Promise.resolve();
      expect(shiftAnimations(sibling), "Expected the sibling to animate its layout shift.").toBe(1);
      expect(Math.round(sibling.getBoundingClientRect().top), "Expected the sibling to start where it was.").toBe(Math.round(before));

      await wait(120);
      await nextFrame();
      const mid = sibling.getBoundingClientRect().top;
      expect(mid > before && mid < before + ITEM_HEIGHT, `Expected an intermediate position, got ${mid - before}px.`).toBe(true);

      await wait(300);
      expect(Math.round(sibling.getBoundingClientRect().top)).toBe(Math.round(before + ITEM_HEIGHT));
      expect(shiftAnimations(sibling)).toBe(0);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
    });

    it("should animate the source list's items into the slot the item left", async () => {
      const fixture = createComponent(AnimatedConnectedDropZones);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const item = groups[0][1].element;
      const follower = groups[0][2].element;
      const before = follower.getBoundingClientRect().top;
      const { left, top } = item.getBoundingClientRect();
      const targetRect = groups[1][0].element.getBoundingClientRect();

      startDraggingViaMouse(fixture, item, left, top);
      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.top + 1);
      fixture.detectChanges();
      await Promise.resolve();

      expect(shiftAnimations(follower), "Expected the source item to animate its layout shift.").toBe(1);
      expect(Math.round(follower.getBoundingClientRect().top)).toBe(Math.round(before));

      await wait(120);
      await nextFrame();
      const mid = follower.getBoundingClientRect().top;
      expect(mid < before && mid > before - ITEM_HEIGHT, `Expected an intermediate position, got ${mid - before}px.`).toBe(true);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
    });

    it("should not animate the layout shift when the items have no transform transition", async () => {
      const fixture = createComponent(SideBySideConnectedDropZones);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const item = groups[0][1].element;
      const sibling = groups[1][0].element;
      const before = sibling.getBoundingClientRect().top;
      const { left, top } = item.getBoundingClientRect();

      startDraggingViaMouse(fixture, item, left, top);
      dispatchMouseEvent(document, "mousemove", sibling.getBoundingClientRect().left + 1, before + 1);
      fixture.detectChanges();
      await Promise.resolve();

      expect(shiftAnimations(sibling)).toBe(0);
      expect(Math.round(sibling.getBoundingClientRect().top)).toBe(Math.round(before + ITEM_HEIGHT));

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
    });

    it("should cancel a running shift before the list measures its items again", async () => {
      const fixture = createComponent(AnimatedConnectedDropZones);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const item = groups[0][1].element;
      const sibling = groups[1][0].element;
      const { left, top } = item.getBoundingClientRect();
      const targetRect = sibling.getBoundingClientRect();
      const sourceRect = groups[0][0].element.getBoundingClientRect();

      startDraggingViaMouse(fixture, item, left, top);
      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.top + 1);
      fixture.detectChanges();
      await Promise.resolve();
      expect(shiftAnimations(sibling)).toBe(1);

      // Back to the source list and straight into the target again, mid-animation.
      dispatchMouseEvent(document, "mousemove", sourceRect.left + 1, sourceRect.top + 1);
      fixture.detectChanges();
      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.top + 1);
      fixture.detectChanges();
      await Promise.resolve();

      expect(shiftAnimations(sibling), "Expected one shift animation at a time.").toBeLessThanOrEqual(1);
      await wait(400);
      expect(Math.round(sibling.getBoundingClientRect().top), "Expected the sibling to settle below the placeholder.").toBe(
        Math.round(targetRect.top + ITEM_HEIGHT),
      );

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
    });
  });
});
