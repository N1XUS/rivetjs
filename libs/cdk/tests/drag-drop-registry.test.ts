// Ported from Angular Components (src/cdk/drag-drop/drag-drop-registry.spec.ts), MIT, © Google LLC.
// Changes: `TestBed.inject(DragDropRegistry)` → a fresh `new DragDropRegistry(document)` per test (destroyed
// in `afterEach`, Angular destroys the injector); `BlankComponent` → a host `<div>`; `ngOnDestroy` →
// `destroy`; `initUIEvent` shimmed for happy-dom; `DragItem` parameter property spelled out (strip-only TS); happy-dom document (install-dom.ts); Jasmine globals from @rivetjs/testing/jasmine.
import { installDom } from "./install-dom.ts";
const { window: domWindow } = installDom();
// happy-dom has no legacy `initUIEvent` (used by the Angular `createTouchEvent` helper): map it to `initEvent`.
const uiEvent = (domWindow as unknown as typeof globalThis).UIEvent.prototype as UIEvent & {
  initUIEvent?: (type: string, bubbles: boolean, cancelable: boolean) => void;
};
uiEvent.initUIEvent ??= function (this: Event, type: string, bubbles: boolean, cancelable: boolean) {
  this.initEvent(type, bubbles, cancelable);
};
import { afterEach, beforeEach, describe, expect, it, jasmine } from "@rivetjs/testing/jasmine";
import { createMouseEvent, dispatchMouseEvent, createTouchEvent, dispatchTouchEvent, dispatchFakeEvent } from "@rivetjs/testing/fake-events";
import type { DragRef } from "../drag-drop/drag-ref.ts";
const { DragDropRegistry } = await import("../drag-drop/drag-drop-registry.ts");
type DragDropRegistry = InstanceType<typeof DragDropRegistry>;

describe("DragDropRegistry", () => {
  let fixture: { nativeElement: HTMLElement };
  let registry: DragDropRegistry;

  beforeEach(() => {
    fixture = { nativeElement: document.body.appendChild(document.createElement("div")) };
    registry = new DragDropRegistry(document);
  });

  afterEach(() => {
    registry.destroy();
    fixture.nativeElement.remove();
  });

  it("should be able to start dragging an item", () => {
    const item = new DragItem() as unknown as DragRef;

    expect(registry.isDragging(item)).toBe(false);
    registry.startDragging(item, createMouseEvent("mousedown"));
    expect(registry.isDragging(item)).toBe(true);
  });

  it("should be able to stop dragging an item", () => {
    const item = new DragItem() as unknown as DragRef;

    registry.startDragging(item, createMouseEvent("mousedown"));
    expect(registry.isDragging(item)).toBe(true);

    registry.stopDragging(item);
    expect(registry.isDragging(item)).toBe(false);
  });

  it("should stop dragging an item if it is removed", () => {
    const item = new DragItem() as unknown as DragRef;

    registry.startDragging(item, createMouseEvent("mousedown"));
    expect(registry.isDragging(item)).toBe(true);

    registry.removeDragItem(item);
    expect(registry.isDragging(item)).toBe(false);
  });

  it("should dispatch `mousemove` events after starting to drag via the mouse", () => {
    const spy = jasmine.createSpy("pointerMove spy");
    const subscription = registry.pointerMove.subscribe(spy);
    const item = new DragItem(true) as unknown as DragRef;
    registry.startDragging(item, createMouseEvent("mousedown"));
    dispatchMouseEvent(document, "mousemove");

    expect(spy).toHaveBeenCalled();

    subscription.unsubscribe();
  });

  it("should dispatch `touchmove` events after starting to drag via touch", () => {
    const spy = jasmine.createSpy("pointerMove spy");
    const subscription = registry.pointerMove.subscribe(spy);
    const item = new DragItem(true) as unknown as DragRef;
    registry.startDragging(item, createTouchEvent("touchstart") as TouchEvent);
    dispatchTouchEvent(document, "touchmove");

    expect(spy).toHaveBeenCalled();

    subscription.unsubscribe();
  });

  it("should dispatch pointer move events if event propagation is stopped", () => {
    const spy = jasmine.createSpy("pointerMove spy");
    const subscription = registry.pointerMove.subscribe(spy);
    const item = new DragItem(true) as unknown as DragRef;
    fixture.nativeElement.addEventListener("mousemove", (e: MouseEvent) => e.stopPropagation());
    registry.startDragging(item, createMouseEvent("mousedown"));
    dispatchMouseEvent(fixture.nativeElement, "mousemove");

    expect(spy).toHaveBeenCalled();

    subscription.unsubscribe();
  });

  it("should dispatch `mouseup` events after ending the drag via the mouse", () => {
    const spy = jasmine.createSpy("pointerUp spy");
    const subscription = registry.pointerUp.subscribe(spy);
    const item = new DragItem() as unknown as DragRef;

    registry.startDragging(item, createMouseEvent("mousedown"));
    dispatchMouseEvent(document, "mouseup");

    expect(spy).toHaveBeenCalled();

    subscription.unsubscribe();
  });

  it("should dispatch `touchend` events after ending the drag via touch", () => {
    const spy = jasmine.createSpy("pointerUp spy");
    const subscription = registry.pointerUp.subscribe(spy);
    const item = new DragItem() as unknown as DragRef;

    registry.startDragging(item, createTouchEvent("touchstart") as TouchEvent);
    dispatchTouchEvent(document, "touchend");

    expect(spy).toHaveBeenCalled();

    subscription.unsubscribe();
  });

  it("should dispatch pointer up events if event propagation is stopped", () => {
    const spy = jasmine.createSpy("pointerUp spy");
    const subscription = registry.pointerUp.subscribe(spy);
    const item = new DragItem() as unknown as DragRef;

    fixture.nativeElement.addEventListener("mouseup", (e: MouseEvent) => e.stopPropagation());
    registry.startDragging(item, createMouseEvent("mousedown"));
    dispatchMouseEvent(fixture.nativeElement, "mouseup");

    expect(spy).toHaveBeenCalled();

    subscription.unsubscribe();
  });

  it("should complete the pointer event streams on destroy", () => {
    const pointerUpSpy = jasmine.createSpy("pointerUp complete spy");
    const pointerMoveSpy = jasmine.createSpy("pointerMove complete spy");
    const pointerUpSubscription = registry.pointerUp.subscribe({ complete: pointerUpSpy });
    const pointerMoveSubscription = registry.pointerMove.subscribe({ complete: pointerMoveSpy });

    registry.destroy();

    expect(pointerUpSpy).toHaveBeenCalled();
    expect(pointerMoveSpy).toHaveBeenCalled();

    pointerUpSubscription.unsubscribe();
    pointerMoveSubscription.unsubscribe();
  });

  it("should not emit pointer events when dragging is over (multi touch)", () => {
    const item = new DragItem() as unknown as DragRef;

    // First finger down
    registry.startDragging(item, createTouchEvent("touchstart") as TouchEvent);
    // Second finger down
    registry.startDragging(item, createTouchEvent("touchstart") as TouchEvent);
    // First finger up
    registry.stopDragging(item);

    // Ensure dragging is over - registry is empty
    expect(registry.isDragging(item)).toBe(false);

    const pointerUpSpy = jasmine.createSpy("pointerUp spy");
    const pointerMoveSpy = jasmine.createSpy("pointerMove spy");

    const pointerUpSubscription = registry.pointerUp.subscribe(pointerUpSpy);
    const pointerMoveSubscription = registry.pointerMove.subscribe(pointerMoveSpy);

    // Second finger keeps moving
    dispatchTouchEvent(document, "touchmove");
    expect(pointerMoveSpy).not.toHaveBeenCalled();

    // Second finger up
    dispatchTouchEvent(document, "touchend");
    expect(pointerUpSpy).not.toHaveBeenCalled();

    pointerUpSubscription.unsubscribe();
    pointerMoveSubscription.unsubscribe();
  });

  it("should not prevent the default `touchmove` actions when nothing is being dragged", () => {
    expect(dispatchTouchEvent(document, "touchmove").defaultPrevented).toBe(false);
  });

  it("should prevent the default `touchmove` action when an item is being dragged", () => {
    const item = new DragItem(true) as unknown as DragRef;
    registry.startDragging(item, createTouchEvent("touchstart") as TouchEvent);
    expect(dispatchTouchEvent(document, "touchmove").defaultPrevented).toBe(true);
  });

  it("should prevent the default `touchmove` if the item does not consider itself as being " + "dragged yet", () => {
    const item = new DragItem(false) as unknown as DragRef & DragItem;
    registry.startDragging(item, createTouchEvent("touchstart") as TouchEvent);
    expect(dispatchTouchEvent(document, "touchmove").defaultPrevented).toBe(false);

    item.shouldBeDragging = true;
    expect(dispatchTouchEvent(document, "touchmove").defaultPrevented).toBe(true);
  });

  it("should prevent the default `touchmove` if event propagation is stopped", () => {
    const item = new DragItem(true) as unknown as DragRef;
    registry.startDragging(item, createTouchEvent("touchstart") as TouchEvent);
    fixture.nativeElement.addEventListener("touchmove", (e: TouchEvent) => e.stopPropagation());

    const event = dispatchTouchEvent(fixture.nativeElement, "touchmove");
    expect(event.defaultPrevented).toBe(true);
  });

  it("should not prevent the default `selectstart` actions when nothing is being dragged", () => {
    expect(dispatchFakeEvent(document, "selectstart").defaultPrevented).toBe(false);
  });

  it("should prevent the default `selectstart` action when an item is being dragged", () => {
    const item = new DragItem(true) as unknown as DragRef;
    registry.startDragging(item, createMouseEvent("mousedown"));
    expect(dispatchFakeEvent(document, "selectstart").defaultPrevented).toBe(true);
  });

  it("should dispatch `scroll` events if the viewport is scrolled while dragging", () => {
    const spy = jasmine.createSpy("scroll spy");
    const subscription = registry.scrolled().subscribe(spy);
    const item = new DragItem() as unknown as DragRef;

    registry.startDragging(item, createMouseEvent("mousedown"));
    dispatchFakeEvent(document, "scroll");

    expect(spy).toHaveBeenCalled();
    subscription.unsubscribe();
  });

  it("should not dispatch `scroll` events when not dragging", () => {
    const spy = jasmine.createSpy("scroll spy");
    const subscription = registry.scrolled().subscribe(spy);

    dispatchFakeEvent(document, "scroll");

    expect(spy).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });

  it("should dispatch `touchcancel` events if the drag was interrupted", () => {
    const spy = jasmine.createSpy("pointerUp spy");
    const subscription = registry.pointerUp.subscribe(spy);
    const item = new DragItem() as unknown as DragRef;

    registry.startDragging(item, createTouchEvent("touchstart") as TouchEvent);
    const event = dispatchTouchEvent(document, "touchcancel");

    expect(spy).toHaveBeenCalledWith(event);

    subscription.unsubscribe();
  });

  class DragItem {
    shouldBeDragging: boolean;
    isDragging() {
      return this.shouldBeDragging;
    }
    constructor(shouldBeDragging = false) {
      this.shouldBeDragging = shouldBeDragging;
      registry.registerDragItem(this as unknown as DragRef);
    }
  }
});
