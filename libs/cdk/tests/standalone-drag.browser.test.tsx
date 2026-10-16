// Ported from Angular Components (src/cdk/drag-drop/directives/standalone-drag.spec.ts), MIT, © Google LLC.
// Changes: Angular fixtures → Rivet TSX views with the upstream names (`createComponent(View, instance)`,
// drag-test-utils.tsx); `@ViewChild(CdkDrag)` → `dragInstance(element)`; `@ViewChild('x')` → DOM lookups;
// inputs that change after the first render are signals; Jasmine globals from `@rivetjs/testing/jasmine`.
// - `fixture.changeDetectorRef.markForCheck()` dropped (bindings update synchronously);
//   `await fixture.whenStable()` → `await wait(0)`; `.withContext(msg)` → `expect(value, msg)`.
// - Plain fixture fields Angular reads on change detection (`boundary`, `dragStartDelay`, `freeDragPosition`,
//   `scale`, `draggingDisabled`, `rootElementSelector`, `showHandle`) are signals: `x = v` → `x.set(v)`.
// - `constrainPosition` is a plain fixture field passed as is (a function prop is read once, at render;
//   an always-present wrapper closure would switch DragRef to its constrained-offset mode); "…constrained
//   to an element while using constrainPosition" assigns it on the fixture before the first render
//   instead of on the directive after it (`DragInstance` inputs are read-only getters over the props).
// - `handleInstance.disabled = v` (CdkDragHandle input) → a `disabled` signal passed to `<DragHandle>`
//   (fixture getter keeps the upstream shape); `@ViewChildren(CdkDragHandle)` → `.cdk-drag-handle`
//   elements wrapped as `{ element: { nativeElement } }`.
// - `<passthrough-component>` → `PassthroughComponent` rendering a wrapper `div`; `<shadow-wrapper>`
//   (ViewEncapsulation.ShadowDom + ng-content) → `ShadowWrapper` mounting its children into an open shadow
//   root; `ngTemplateOutlet` of an outside `ng-template` → a template function called inside `<Drag>`;
//   `<ng-container cdkDrag cdkDragRootElement>` → a `<Drag>` element wrapping the content (Rivet
//   components always render an element); the `ViewEncapsulation.None` styles → a `<style>` element in the view.
// - `CDK_DRAG_CONFIG` provider → `createComponent(…, { dragConfig })`.
// - Spies made with `spyOn` are restored after each test (Jasmine does that by itself).
// Skipped (`it.skip`): "should throw if drag item is attached to an ng-container" (ng-container +
// Angular ErrorHandler: `<Drag>` always renders an element), "should throw if drag handle is attached
// to an ng-container" (same: `<DragHandle>` always renders an element). Their fixtures
// (`DraggableOnNgContainer`, `DragHandleOnNgContainer`) are not ported.
// Not ported: standalone-drag.zone.spec.ts ("should emit to `moved` inside the NgZone": NgZone only).
import { afterEach, describe, expect, it, jasmine, spyOn } from "@rivetjs/testing/jasmine";
import { vi } from "vitest";
import { onCleanup, signal } from "@rivetjs/reactivity";
import { Show, mount } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { createMouseEvent, createTouchEvent, dispatchEvent, dispatchFakeEvent, dispatchMouseEvent, dispatchTouchEvent } from "@rivetjs/testing/fake-events";
import {
  Drag,
  DragHandle,
  DragRef,
  dragInstance,
  type DragAxis,
  type DragDropConfig,
  type DragInstance,
  type DragStartDelay,
  type Point,
} from "../drag-drop/index.tsx";
import { isInsideClientRect, isOverflowingParent } from "../drag-drop/dom/dom-rect.ts";
import {
  TestComponent,
  continueDraggingViaTouch,
  createComponent,
  destroyFixtures,
  dragElementViaMouse,
  dragElementViaTouch,
  makeScrollable,
  startDraggingViaMouse,
  startDraggingViaTouch,
  wait,
} from "./drag-test-utils.tsx";

afterEach(() => {
  destroyFixtures();
  vi.restoreAllMocks();
});

const supportsShadowDom = () => typeof document.head.attachShadow === "function";

describe("Standalone CdkDrag", () => {
  describe("mouse dragging", () => {
    it("should drag an element freely to a particular position (mouse)", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;

      expect(dragElement.style.transform).toBeFalsy();
      dragElementViaMouse(fixture, dragElement, 50, 100);
      expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");
    });

    it("should reset drag item to boundary", () => {
      const fixture = createComponent(DragWithResizeableBoundary);
      fixture.detectChanges();
      let boundaryElement = fixture.componentInstance.boundaryElement.nativeElement;
      let dragElement = fixture.componentInstance.dragElement.nativeElement;

      dragElementViaMouse(fixture, dragElement, 50, 100);

      // check if the drag element is within the boundary or not
      expect(
        isInsideClientRect(
          boundaryElement.getBoundingClientRect(),
          fixture.componentInstance.dragInstance.getFreeDragPosition().x,
          fixture.componentInstance.dragInstance.getFreeDragPosition().y,
        ),
      ).toBeTrue();

      // drag it till the end of the boundary
      dragElementViaMouse(fixture, dragElement, 400, 400);

      // it should still be present within the boundary
      expect(
        isInsideClientRect(
          boundaryElement.getBoundingClientRect(),
          fixture.componentInstance.dragInstance.getFreeDragPosition().x,
          fixture.componentInstance.dragInstance.getFreeDragPosition().y,
        ),
      ).toBeTrue();

      // shrink boundary to check if we are within boundary or not
      fixture.componentInstance.setBoundary("200px", "200px");
      fixture.detectChanges();

      // it should not be within the boundary anymore as we shrinked it
      expect(
        isInsideClientRect(
          boundaryElement.getBoundingClientRect(),
          fixture.componentInstance.dragInstance.getFreeDragPosition().x,
          fixture.componentInstance.dragInstance.getFreeDragPosition().y,
        ),
      ).toBeFalse();

      fixture.componentInstance.dragInstance.resetToBoundary();
      fixture.detectChanges();

      // should be be within bounding box of its boundary now that we have reseted it
      expect(
        isInsideClientRect(
          boundaryElement.getBoundingClientRect(),
          fixture.componentInstance.dragInstance.getFreeDragPosition().x,
          fixture.componentInstance.dragInstance.getFreeDragPosition().y,
        ),
      ).toBeTrue();

      // expand the boundary enough that so can we can make the draggable item to be overflown
      // of its parent from top side
      fixture.componentInstance.setBoundary("500px", "500px");
      fixture.detectChanges();

      // drag it till the end of the boundary
      dragElementViaMouse(fixture, dragElement, 500, 500);

      // shrink boundary to make draggable item to be overflown
      fixture.componentInstance.setBoundary("400px", "400px");
      fixture.detectChanges();

      // should be within bounding rect but it's overflowing as it was placed in a way that
      // it is overflowing
      expect(isOverflowingParent(boundaryElement.getBoundingClientRect(), dragElement.getBoundingClientRect())).toBeTrue();

      // reset it so that overflowing offset is fixed
      fixture.componentInstance.dragInstance.resetToBoundary();
      fixture.detectChanges();

      // should be within bounding rect but it's overflowing as it was placed in a way that
      // it is overflowing
      expect(isOverflowingParent(boundaryElement.getBoundingClientRect(), dragElement.getBoundingClientRect())).toBeFalse();
    });

    it("should drag an element freely to a particular position when the page is scrolled (mouse)", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();

      const cleanup = makeScrollable();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;

      scrollTo(0, 500);
      expect(dragElement.style.transform).toBeFalsy();
      dragElementViaMouse(fixture, dragElement, 50, 100);
      expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");
      cleanup();
    });

    it("should continue dragging the element from where it was left off (mouse)", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;

      expect(dragElement.style.transform).toBeFalsy();

      dragElementViaMouse(fixture, dragElement, 50, 100);
      expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");

      dragElementViaMouse(fixture, dragElement, 100, 200);
      expect(dragElement.style.transform).toBe("translate3d(150px, 300px, 0px)");
    });

    it("should continue dragging from where it was left off when the page is scrolled (mouse)", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();

      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const cleanup = makeScrollable();

      scrollTo(0, 500);
      expect(dragElement.style.transform).toBeFalsy();

      dragElementViaMouse(fixture, dragElement, 50, 100);
      expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");

      dragElementViaMouse(fixture, dragElement, 100, 200);
      expect(dragElement.style.transform).toBe("translate3d(150px, 300px, 0px)");

      cleanup();
    });

    it("should not drag an element with the right mouse button", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const event = createMouseEvent("mousedown", 50, 100, 2);

      expect(dragElement.style.transform).toBeFalsy();

      dispatchEvent(dragElement, event);
      fixture.detectChanges();

      dispatchMouseEvent(document, "mousemove", 50, 100);
      fixture.detectChanges();

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();

      expect(dragElement.style.transform).toBeFalsy();
    });

    it("should not drag the element if it was not moved more than the minimum distance", () => {
      const fixture = createComponent(StandaloneDraggable, { dragDistance: 5 });
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;

      expect(dragElement.style.transform).toBeFalsy();
      dragElementViaMouse(fixture, dragElement, 2, 2);
      expect(dragElement.style.transform).toBeFalsy();
    });

    it("should be able to stop dragging after a double click", () => {
      const fixture = createComponent(StandaloneDraggable, { dragDistance: 5 });
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;

      expect(dragElement.style.transform).toBeFalsy();

      dispatchMouseEvent(dragElement, "mousedown");
      fixture.detectChanges();
      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      dispatchMouseEvent(dragElement, "mousedown");
      fixture.detectChanges();
      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();

      dragElementViaMouse(fixture, dragElement, 50, 50);
      dispatchMouseEvent(document, "mousemove", 100, 100);
      fixture.detectChanges();

      expect(dragElement.style.transform).toBeFalsy();
    });

    it("should preserve the previous `transform` value", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;

      dragElement.style.transform = "translateX(-50%)";
      dragElementViaMouse(fixture, dragElement, 50, 100);
      expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px) translateX(-50%)");
    });

    it("should not generate multiple own `translate3d` values", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;

      dragElement.style.transform = "translateY(-50%)";

      dragElementViaMouse(fixture, dragElement, 50, 100);
      expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px) translateY(-50%)");

      dragElementViaMouse(fixture, dragElement, 100, 200);
      expect(dragElement.style.transform).toBe("translate3d(150px, 300px, 0px) translateY(-50%)");
    });

    it("should prevent the `mousedown` action for native draggable elements", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;

      dragElement.draggable = true;

      const mousedownEvent = createMouseEvent("mousedown", 50, 50);
      Object.defineProperty(mousedownEvent, "target", { get: () => dragElement });
      spyOn(mousedownEvent, "preventDefault").and.callThrough();
      dispatchEvent(dragElement, mousedownEvent);
      fixture.detectChanges();

      dispatchMouseEvent(document, "mousemove", 50, 50);
      fixture.detectChanges();

      expect(mousedownEvent.preventDefault).toHaveBeenCalled();
    });

    it("should not start dragging an element with a fake mousedown event", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const event = createMouseEvent("mousedown", 0, 0);

      Object.defineProperties(event, {
        buttons: { get: () => 0 },
        detail: { get: () => 0 },
      });

      expect(dragElement.style.transform).toBeFalsy();

      dispatchEvent(dragElement, event);
      fixture.detectChanges();

      dispatchMouseEvent(document, "mousemove", 20, 100);
      fixture.detectChanges();
      dispatchMouseEvent(document, "mousemove", 50, 100);
      fixture.detectChanges();

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();

      expect(dragElement.style.transform).toBeFalsy();
    });

    it("should prevent the default dragstart action", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();
      const event = dispatchFakeEvent(fixture.componentInstance.dragElement.nativeElement, "dragstart");
      fixture.detectChanges();

      expect(event.defaultPrevented).toBe(true);
    });

    it("should not prevent the default dragstart action when dragging is disabled", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.componentInstance.dragDisabled.set(true);
      fixture.detectChanges();
      const event = dispatchFakeEvent(fixture.componentInstance.dragElement.nativeElement, "dragstart");
      fixture.detectChanges();

      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe("touch dragging", () => {
    it("should drag an element freely to a particular position (touch)", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;

      expect(dragElement.style.transform).toBeFalsy();
      dragElementViaTouch(fixture, dragElement, 50, 100);
      expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");
    });

    it("should drag an element freely to a particular position when the page is scrolled (touch)", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();

      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const cleanup = makeScrollable();

      scrollTo(0, 500);
      expect(dragElement.style.transform).toBeFalsy();
      dragElementViaTouch(fixture, dragElement, 50, 100);
      expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");
      cleanup();
    });

    it("should continue dragging the element from where it was left off (touch)", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;

      expect(dragElement.style.transform).toBeFalsy();

      dragElementViaTouch(fixture, dragElement, 50, 100);
      expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");

      dragElementViaTouch(fixture, dragElement, 100, 200);
      expect(dragElement.style.transform).toBe("translate3d(150px, 300px, 0px)");
    });

    it("should continue dragging from where it was left off when the page is scrolled (touch)", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();

      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const cleanup = makeScrollable();

      scrollTo(0, 500);
      expect(dragElement.style.transform).toBeFalsy();

      dragElementViaTouch(fixture, dragElement, 50, 100);
      expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");

      dragElementViaTouch(fixture, dragElement, 100, 200);
      expect(dragElement.style.transform).toBe("translate3d(150px, 300px, 0px)");

      cleanup();
    });

    it("should prevent the default `touchmove` action on the page while dragging", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();

      dispatchTouchEvent(fixture.componentInstance.dragElement.nativeElement, "touchstart");
      fixture.detectChanges();

      expect(dispatchTouchEvent(document, "touchmove").defaultPrevented, "Expected initial touchmove to be prevented.").toBe(true);
      expect(dispatchTouchEvent(document, "touchmove").defaultPrevented, "Expected subsequent touchmose to be prevented.").toBe(true);

      dispatchTouchEvent(document, "touchend");
      fixture.detectChanges();
    });

    it("should not prevent `touchstart` action for native draggable elements", async () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;

      dragElement.draggable = true;

      const touchstartEvent = createTouchEvent("touchstart", 50, 50);
      Object.defineProperty(touchstartEvent, "target", { get: () => dragElement });
      spyOn(touchstartEvent, "preventDefault").and.callThrough();
      dispatchEvent(dragElement, touchstartEvent);
      fixture.detectChanges();

      dispatchTouchEvent(document, "touchmove");
      fixture.detectChanges();

      expect(touchstartEvent.preventDefault).not.toHaveBeenCalled();
    });

    it("should not start dragging an element with a fake touchstart event", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const event = createTouchEvent("touchstart", 50, 50) as TouchEvent;

      Object.defineProperties(event.touches[0], {
        identifier: { get: () => -1 },
        radiusX: { get: () => null },
        radiusY: { get: () => null },
      });

      expect(dragElement.style.transform).toBeFalsy();

      dispatchEvent(dragElement, event);
      fixture.detectChanges();

      dispatchTouchEvent(document, "touchmove", 20, 100);
      fixture.detectChanges();
      dispatchTouchEvent(document, "touchmove", 50, 100);
      fixture.detectChanges();

      dispatchTouchEvent(document, "touchend");
      fixture.detectChanges();

      expect(dragElement.style.transform).toBeFalsy();
    });

    it("should stop dragging on touchcancel", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const x = 50;
      const y = 100;

      expect(dragElement.style.transform).toBeFalsy();
      startDraggingViaTouch(fixture, dragElement);
      continueDraggingViaTouch(fixture, x, y);
      dispatchTouchEvent(document, "touchcancel", x, y);
      fixture.detectChanges();
      expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");
      expect(fixture.componentInstance.endedSpy).toHaveBeenCalled();
    });
  });

  describe("mouse dragging when initial transform is none", () => {
    it("should drag an element freely to a particular position (mouse, initial transform none)", () => {
      const fixture = createComponent(StandaloneDraggable);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      dragElement.style.transform = "none";

      dragElementViaMouse(fixture, dragElement, 50, 100);
      expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");
    });
  });

  it("should dispatch an event when the user has started dragging", async () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();

    startDraggingViaMouse(fixture, fixture.componentInstance.dragElement.nativeElement);

    expect(fixture.componentInstance.startedSpy).toHaveBeenCalled();

    const event = fixture.componentInstance.startedSpy.calls.mostRecent().args[0];

    // Assert the event like this, rather than `toHaveBeenCalledWith`, because Jasmine will
    // go into an infinite loop trying to stringify the event, if the test fails.
    expect(event).toEqual({
      source: fixture.componentInstance.dragInstance,
      event: jasmine.anything(),
    });
  });

  it("should dispatch an event when the user has stopped dragging", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();

    dragElementViaMouse(fixture, fixture.componentInstance.dragElement.nativeElement, 5, 10);

    expect(fixture.componentInstance.endedSpy).toHaveBeenCalled();

    const event = fixture.componentInstance.endedSpy.calls.mostRecent().args[0];

    // Assert the event like this, rather than `toHaveBeenCalledWith`, because Jasmine will
    // go into an infinite loop trying to stringify the event, if the test fails.
    expect(event).toEqual({
      source: fixture.componentInstance.dragInstance,
      distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
      dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
      event: jasmine.anything(),
    });
  });

  it("should include the drag distance in the ended event", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();

    dragElementViaMouse(fixture, fixture.componentInstance.dragElement.nativeElement, 25, 30);
    let event = fixture.componentInstance.endedSpy.calls.mostRecent().args[0];

    expect(event).toEqual({
      source: jasmine.anything(),
      distance: { x: 25, y: 30 },
      dropPoint: { x: 25, y: 30 },
      event: jasmine.anything(),
    });

    dragElementViaMouse(fixture, fixture.componentInstance.dragElement.nativeElement, 40, 50);
    event = fixture.componentInstance.endedSpy.calls.mostRecent().args[0];

    expect(event).toEqual({
      source: jasmine.anything(),
      distance: { x: 40, y: 50 },
      dropPoint: { x: 40, y: 50 },
      event: jasmine.anything(),
    });
  });

  it("should emit when the user is moving the drag element", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();

    const spy = jasmine.createSpy("move spy");
    const subscription = fixture.componentInstance.dragInstance.moved.subscribe(spy);

    dragElementViaMouse(fixture, fixture.componentInstance.dragElement.nativeElement, 5, 10);
    expect(spy).toHaveBeenCalledTimes(1);

    dragElementViaMouse(fixture, fixture.componentInstance.dragElement.nativeElement, 10, 20);
    expect(spy).toHaveBeenCalledTimes(2);

    subscription.unsubscribe();
  });

  it("should not emit events if it was not moved more than the minimum distance", () => {
    const fixture = createComponent(StandaloneDraggable, { dragDistance: 5 });
    fixture.detectChanges();

    const moveSpy = jasmine.createSpy("move spy");
    const subscription = fixture.componentInstance.dragInstance.moved.subscribe(moveSpy);

    dragElementViaMouse(fixture, fixture.componentInstance.dragElement.nativeElement, 2, 2);

    expect(fixture.componentInstance.startedSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.releasedSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.endedSpy).not.toHaveBeenCalled();
    expect(moveSpy).not.toHaveBeenCalled();
    subscription.unsubscribe();
  });

  it("should complete the `moved` stream on destroy", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();

    const spy = jasmine.createSpy("move spy");
    const subscription = fixture.componentInstance.dragInstance.moved.subscribe({ complete: spy });

    fixture.destroy();
    expect(spy).toHaveBeenCalled();
    subscription.unsubscribe();
  });

  it("should be able to lock dragging along the x axis", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.componentInstance.dragLockAxis.set("x");
    fixture.detectChanges();

    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform).toBeFalsy();

    dragElementViaMouse(fixture, dragElement, 50, 100);
    expect(dragElement.style.transform).toBe("translate3d(50px, 0px, 0px)");

    dragElementViaMouse(fixture, dragElement, 100, 200);
    expect(dragElement.style.transform).toBe("translate3d(150px, 0px, 0px)");
  });

  it("should be able to lock dragging along the x axis while using constrainPosition", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.componentInstance.dragLockAxis.set("x");
    fixture.componentInstance.constrainPosition = ({ x, y }: Point, _dragRef: DragRef, _dimensions: DOMRect, pickup: Point) => {
      x -= pickup.x;
      y -= pickup.y;
      return { x, y };
    };
    fixture.detectChanges();

    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform).toBeFalsy();

    dragElementViaMouse(fixture, dragElement, 50, 100);
    expect(dragElement.style.transform).toBe("translate3d(50px, 0px, 0px)");

    dragElementViaMouse(fixture, dragElement, 100, 200);
    expect(dragElement.style.transform).toBe("translate3d(150px, 0px, 0px)");
  });

  it("should be able to lock dragging along the y axis", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.componentInstance.dragLockAxis.set("y");
    fixture.detectChanges();

    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform).toBeFalsy();

    dragElementViaMouse(fixture, dragElement, 50, 100);
    expect(dragElement.style.transform).toBe("translate3d(0px, 100px, 0px)");

    dragElementViaMouse(fixture, dragElement, 100, 200);
    expect(dragElement.style.transform).toBe("translate3d(0px, 300px, 0px)");
  });

  it("should be able to lock dragging along the y axis while using constrainPosition", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.componentInstance.dragLockAxis.set("y");
    fixture.componentInstance.constrainPosition = ({ x, y }: Point, _dragRef: DragRef, _dimensions: DOMRect, pickup: Point) => {
      x -= pickup.x;
      y -= pickup.y;
      return { x, y };
    };
    fixture.detectChanges();

    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform).toBeFalsy();

    dragElementViaMouse(fixture, dragElement, 50, 100);
    expect(dragElement.style.transform).toBe("translate3d(0px, 100px, 0px)");

    dragElementViaMouse(fixture, dragElement, 100, 200);
    expect(dragElement.style.transform).toBe("translate3d(0px, 300px, 0px)");
  });

  it("should add a class while an element is being dragged", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();

    const element = fixture.componentInstance.dragElement.nativeElement;

    expect(element.classList).not.toContain("cdk-drag-dragging");

    startDraggingViaMouse(fixture, element);

    expect(element.classList).toContain("cdk-drag-dragging");

    dispatchMouseEvent(document, "mouseup");
    fixture.detectChanges();

    expect(element.classList).not.toContain("cdk-drag-dragging");
  });

  it("should add a class while an element is being dragged with OnPush change detection", () => {
    const fixture = createComponent(StandaloneDraggableWithOnPush);
    fixture.detectChanges();

    const element = fixture.componentInstance.dragElement.nativeElement;

    expect(element.classList).not.toContain("cdk-drag-dragging");

    startDraggingViaMouse(fixture, element);

    expect(element.classList).toContain("cdk-drag-dragging");

    dispatchMouseEvent(document, "mouseup");
    fixture.detectChanges();

    expect(element.classList).not.toContain("cdk-drag-dragging");
  });

  it("should not add a class if item was not dragged more than the threshold", async () => {
    const fixture = createComponent(StandaloneDraggable, { dragDistance: 5 });
    fixture.detectChanges();

    const element = fixture.componentInstance.dragElement.nativeElement;

    expect(element.classList).not.toContain("cdk-drag-dragging");

    startDraggingViaMouse(fixture, element);

    expect(element.classList).not.toContain("cdk-drag-dragging");
  });

  it("should be able to set an alternate drag root element", () => {
    const fixture = createComponent(DraggableWithAlternateRoot);
    fixture.componentInstance.rootElementSelector.set(".alternate-root");
    fixture.detectChanges();

    const dragRoot = fixture.componentInstance.dragRoot.nativeElement;
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragRoot.style.transform).toBeFalsy();
    expect(dragElement.style.transform).toBeFalsy();

    dragElementViaMouse(fixture, dragRoot, 50, 100);

    expect(dragRoot.style.transform).toBe("translate3d(50px, 100px, 0px)");
    expect(dragElement.style.transform).toBeFalsy();
  });

  it("should be able to set the cdkDrag element as handle if it has a different root element", () => {
    const fixture = createComponent(DraggableWithAlternateRootAndSelfHandle);
    fixture.detectChanges();

    const dragRoot = fixture.componentInstance.dragRoot.nativeElement;
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragRoot.style.transform).toBeFalsy();
    expect(dragElement.style.transform).toBeFalsy();

    // Try dragging the root. This should be possible since the drag element is the handle.
    dragElementViaMouse(fixture, dragRoot, 50, 100);

    expect(dragRoot.style.transform).toBeFalsy();
    expect(dragElement.style.transform).toBeFalsy();

    // Drag via the drag element which acts as the handle.
    dragElementViaMouse(fixture, dragElement, 50, 100);

    expect(dragRoot.style.transform).toBe("translate3d(50px, 100px, 0px)");
    expect(dragElement.style.transform).toBeFalsy();
  });

  it("should be able to set an alternate drag root element for ng-container", () => {
    const fixture = createComponent(DraggableNgContainerWithAlternateRoot);
    fixture.detectChanges();

    const dragRoot = fixture.componentInstance.dragRoot.nativeElement;

    expect(dragRoot.style.transform).toBeFalsy();

    dragElementViaMouse(fixture, dragRoot, 50, 100);

    expect(dragRoot.style.transform).toBe("translate3d(50px, 100px, 0px)");
  });

  it("should preserve the initial transform if the root element changes", () => {
    const fixture = createComponent(DraggableWithAlternateRoot);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;
    const alternateRoot = fixture.componentInstance.dragRoot.nativeElement;

    dragElement.style.transform = "translateX(-50%)";
    dragElementViaMouse(fixture, dragElement, 50, 100);
    expect(dragElement.style.transform).toContain("translateX(-50%)");

    alternateRoot.style.transform = "scale(2)";
    fixture.componentInstance.rootElementSelector.set(".alternate-root");
    fixture.detectChanges();

    dragElementViaMouse(fixture, alternateRoot, 50, 100);

    expect(alternateRoot.style.transform).not.toContain("translateX(-50%)");
    expect(alternateRoot.style.transform).toContain("scale(2)");
  });

  it("should handle the root element selector changing after init", async () => {
    const fixture = createComponent(DraggableWithAlternateRoot);
    fixture.detectChanges();
    await wait(0);

    fixture.componentInstance.rootElementSelector.set(".alternate-root");
    fixture.detectChanges();

    const dragRoot = fixture.componentInstance.dragRoot.nativeElement;
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragRoot.style.transform).toBeFalsy();
    expect(dragElement.style.transform).toBeFalsy();

    dragElementViaMouse(fixture, dragRoot, 50, 100);

    expect(dragRoot.style.transform).toBe("translate3d(50px, 100px, 0px)");
    expect(dragElement.style.transform).toBeFalsy();
  });

  it("should not be able to drag the element if dragging is disabled", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.classList).not.toContain("cdk-drag-disabled");

    fixture.componentInstance.dragDisabled.set(true);
    fixture.detectChanges();

    expect(dragElement.classList).toContain("cdk-drag-disabled");
    expect(dragElement.style.transform).toBeFalsy();
    dragElementViaMouse(fixture, dragElement, 50, 100);
    expect(dragElement.style.transform).toBeFalsy();
  });

  it("should enable native drag interactions if dragging is disabled", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;
    const styles = dragElement.style;

    expect(styles.touchAction || (styles as any).webkitUserDrag).toBeFalsy();

    fixture.componentInstance.dragDisabled.set(true);
    fixture.detectChanges();

    expect(styles.touchAction || (styles as any).webkitUserDrag).toBeFalsy();
  });

  it("should enable native drag interactions if not dragging", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;
    const styles = dragElement.style;

    expect(styles.touchAction || (styles as any).webkitUserDrag).toBeFalsy();
  });

  it("should disable native drag interactions if dragging", async () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;
    const styles = dragElement.style;

    expect(styles.touchAction || (styles as any).webkitUserDrag).toBeFalsy();

    startDraggingViaMouse(fixture, dragElement);
    dispatchMouseEvent(document, "mousemove", 50, 100);
    fixture.detectChanges();

    expect(styles.touchAction || (styles as any).webkitUserDrag).toBe("none");
  });

  it("should re-enable drag interactions once dragging is over", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;
    const styles = dragElement.style;

    startDraggingViaMouse(fixture, dragElement);
    dispatchMouseEvent(document, "mousemove", 50, 100);
    fixture.detectChanges();

    expect(styles.touchAction || (styles as any).webkitUserDrag).toBe("none");

    dispatchMouseEvent(document, "mouseup", 50, 100);
    fixture.detectChanges();

    expect(styles.touchAction || (styles as any).webkitUserDrag).toBeFalsy();
  });

  it("should not stop propagation for the drag sequence start event by default", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    const event = createMouseEvent("mousedown");
    spyOn(event, "stopPropagation").and.callThrough();

    dispatchEvent(dragElement, event);
    fixture.detectChanges();

    expect(event.stopPropagation).not.toHaveBeenCalled();
  });

  it("should not throw if destroyed before the first change detection run", () => {
    const fixture = createComponent(StandaloneDraggable);

    expect(() => {
      fixture.destroy();
    }).not.toThrow();
  });

  it("should enable native drag interactions on the drag item when there is a handle", () => {
    const fixture = createComponent(StandaloneDraggableWithHandle);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;
    expect(dragElement.style.touchAction).not.toBe("none");
  });

  it("should disable native drag interactions on the drag handle", () => {
    const fixture = createComponent(StandaloneDraggableWithHandle);
    fixture.detectChanges();
    const styles = fixture.componentInstance.handleElement.nativeElement.style;
    expect(styles.touchAction || (styles as any).webkitUserDrag).toBe("none");
  });

  it("should enable native drag interactions on the drag handle if dragging is disabled", () => {
    const fixture = createComponent(StandaloneDraggableWithHandle);
    fixture.detectChanges();
    fixture.componentInstance.draggingDisabled.set(true);
    fixture.detectChanges();
    const styles = fixture.componentInstance.handleElement.nativeElement.style;
    expect(styles.touchAction || (styles as any).webkitUserDrag).toBeFalsy();
  });

  it("should enable native drag interactions on the drag handle if dragging is disabled " + "on init", () => {
    const fixture = createComponent(StandaloneDraggableWithHandle);
    fixture.componentInstance.draggingDisabled.set(true);
    fixture.detectChanges();
    const styles = fixture.componentInstance.handleElement.nativeElement.style;
    expect(styles.touchAction || (styles as any).webkitUserDrag).toBeFalsy();
  });

  it("should toggle native drag interactions based on whether the handle is disabled", () => {
    const fixture = createComponent(StandaloneDraggableWithHandle);
    fixture.detectChanges();
    fixture.componentInstance.handleInstance.disabled = true;
    fixture.detectChanges();
    const styles = fixture.componentInstance.handleElement.nativeElement.style;
    expect(styles.touchAction || (styles as any).webkitUserDrag).toBeFalsy();

    fixture.componentInstance.handleInstance.disabled = false;
    fixture.detectChanges();
    expect(styles.touchAction || (styles as any).webkitUserDrag).toBe("none");
  });

  it("should be able to reset a freely-dragged item to its initial position", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform).toBeFalsy();
    dragElementViaMouse(fixture, dragElement, 50, 100);
    expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");

    fixture.componentInstance.dragInstance.reset();
    expect(dragElement.style.transform).toBeFalsy();
  });

  it("should preserve initial transform after resetting", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    dragElement.style.transform = "scale(2)";

    dragElementViaMouse(fixture, dragElement, 50, 100);
    expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px) scale(2)");

    fixture.componentInstance.dragInstance.reset();
    expect(dragElement.style.transform).toBe("scale(2)");
  });

  it("should start dragging an item from its initial position after a reset", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform).toBeFalsy();
    dragElementViaMouse(fixture, dragElement, 50, 100);
    expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");
    fixture.componentInstance.dragInstance.reset();

    dragElementViaMouse(fixture, dragElement, 25, 50);
    expect(dragElement.style.transform).toBe("translate3d(25px, 50px, 0px)");
  });

  it("should not dispatch multiple events for a mouse event right after a touch event", async () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();

    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    // Dispatch a touch sequence.
    dispatchTouchEvent(dragElement, "touchstart");
    fixture.detectChanges();
    dispatchTouchEvent(dragElement, "touchend");
    fixture.detectChanges();
    await wait(0);

    // Immediately dispatch a mouse sequence to simulate a fake event.
    startDraggingViaMouse(fixture, dragElement);
    fixture.detectChanges();
    dispatchMouseEvent(dragElement, "mouseup");
    fixture.detectChanges();
    await wait(0);

    expect(fixture.componentInstance.startedSpy).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.endedSpy).toHaveBeenCalledTimes(1);
  });

  it("should round the transform value", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform).toBeFalsy();
    dragElementViaMouse(fixture, dragElement, 13.37, 37);
    expect(dragElement.style.transform).toBe("translate3d(13px, 37px, 0px)");
  });

  it("should allow for dragging to be constrained to an element", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.componentInstance.boundary.set(".wrapper");
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform).toBeFalsy();
    dragElementViaMouse(fixture, dragElement, 300, 300);
    expect(dragElement.style.transform).toBe("translate3d(100px, 100px, 0px)");
  });

  it("should allow for dragging to be constrained to an element while using constrainPosition", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.componentInstance.boundary.set(".wrapper");
    fixture.componentInstance.constrainPosition = ({ x, y }: Point, _dragRef: DragRef, _dimensions: DOMRect, pickup: Point) => {
      x -= pickup.x;
      y -= pickup.y;
      return { x, y };
    };
    fixture.detectChanges();

    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform).toBeFalsy();
    dragElementViaMouse(fixture, dragElement, 300, 300);
    expect(dragElement.style.transform).toBe("translate3d(100px, 100px, 0px)");
  });

  it("should be able to pass in a DOM node as the boundary", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.componentInstance.boundary.set(fixture.nativeElement.querySelector<HTMLElement>(".wrapper")!);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform).toBeFalsy();
    dragElementViaMouse(fixture, dragElement, 300, 300);
    expect(dragElement.style.transform).toBe("translate3d(100px, 100px, 0px)");
  });

  it("should adjust the x offset if the boundary becomes narrower after a viewport resize", async () => {
    const fixture = createComponent(StandaloneDraggable);
    const boundary: HTMLElement = fixture.nativeElement.querySelector(".wrapper")!;
    fixture.componentInstance.boundary.set(boundary);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    dragElementViaMouse(fixture, dragElement, 300, 300);
    expect(dragElement.style.transform).toBe("translate3d(100px, 100px, 0px)");

    boundary.style.width = "150px";
    dispatchFakeEvent(window, "resize");
    await wait(20);

    expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");
  });

  it("should keep the old position if the boundary is invisible after a resize", async () => {
    const fixture = createComponent(StandaloneDraggable);
    const boundary: HTMLElement = fixture.nativeElement.querySelector(".wrapper")!;
    fixture.componentInstance.boundary.set(boundary);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    dragElementViaMouse(fixture, dragElement, 300, 300);
    expect(dragElement.style.transform).toBe("translate3d(100px, 100px, 0px)");

    boundary.style.display = "none";
    dispatchFakeEvent(window, "resize");
    await wait(20);

    expect(dragElement.style.transform).toBe("translate3d(100px, 100px, 0px)");
  });

  it("should handle the element and boundary dimensions changing between drag sequences", () => {
    const fixture = createComponent(StandaloneDraggable);
    const boundary: HTMLElement = fixture.nativeElement.querySelector(".wrapper")!;
    fixture.componentInstance.boundary.set(boundary);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    dragElementViaMouse(fixture, dragElement, 300, 300);
    expect(dragElement.style.transform).toBe("translate3d(100px, 100px, 0px)");

    // Bump the width and height of both the boundary and the drag element.
    boundary.style.width = boundary.style.height = "300px";
    dragElement.style.width = dragElement.style.height = "150px";

    dragElementViaMouse(fixture, dragElement, 300, 300);
    expect(dragElement.style.transform).toBe("translate3d(150px, 150px, 0px)");
  });

  it("should adjust the y offset if the boundary becomes shorter after a viewport resize", async () => {
    const fixture = createComponent(StandaloneDraggable);
    const boundary: HTMLElement = fixture.nativeElement.querySelector(".wrapper")!;
    fixture.componentInstance.boundary.set(boundary);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    dragElementViaMouse(fixture, dragElement, 300, 300);
    expect(dragElement.style.transform).toBe("translate3d(100px, 100px, 0px)");

    boundary.style.height = "150px";
    dispatchFakeEvent(window, "resize");
    await wait(20);

    expect(dragElement.style.transform).toBe("translate3d(100px, 50px, 0px)");
  });

  it("should reset the x offset if the boundary becomes narrower than the element " + "after a resize", async () => {
    const fixture = createComponent(StandaloneDraggable);
    const boundary: HTMLElement = fixture.nativeElement.querySelector(".wrapper")!;
    fixture.componentInstance.boundary.set(boundary);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    dragElementViaMouse(fixture, dragElement, 300, 300);
    expect(dragElement.style.transform).toBe("translate3d(100px, 100px, 0px)");

    boundary.style.width = "50px";
    dispatchFakeEvent(window, "resize");
    await wait(20);

    expect(dragElement.style.transform).toBe("translate3d(0px, 100px, 0px)");
  });

  it("should reset the y offset if the boundary becomes shorter than the element after a resize", async () => {
    const fixture = createComponent(StandaloneDraggable);
    const boundary: HTMLElement = fixture.nativeElement.querySelector(".wrapper")!;
    fixture.componentInstance.boundary.set(boundary);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    dragElementViaMouse(fixture, dragElement, 300, 300);
    expect(dragElement.style.transform).toBe("translate3d(100px, 100px, 0px)");

    boundary.style.height = "50px";
    dispatchFakeEvent(window, "resize");
    await wait(20);

    expect(dragElement.style.transform).toBe("translate3d(100px, 0px, 0px)");
  });

  it("should allow for the position constrain logic to be customized", () => {
    const fixture = createComponent(StandaloneDraggable);
    const spy = jasmine.createSpy("constrain position spy").and.returnValue({
      x: 50,
      y: 50,
    } as Point);

    fixture.componentInstance.constrainPosition = spy;
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform).toBeFalsy();
    dragElementViaMouse(fixture, dragElement, 300, 300);

    expect(spy).toHaveBeenCalledWith(
      jasmine.objectContaining({ x: 300, y: 300 }),
      jasmine.any(DragRef),
      jasmine.anything(),
      jasmine.objectContaining({ x: jasmine.any(Number), y: jasmine.any(Number) }),
    );

    const elementRect = dragElement.getBoundingClientRect();
    expect(Math.floor(elementRect.top)).toBe(50);
    expect(Math.floor(elementRect.left)).toBe(50);
  });

  it.skip("should throw if drag item is attached to an ng-container", () => {
    // ng-container + Angular ErrorHandler: `<Drag>` always renders an element (see the header).
  });

  it("should cancel drag if the mouse moves before the delay is elapsed", async () => {
    // We can't use Jasmine's `clock` because Zone.js interferes with it.
    spyOn(Date, "now").and.callFake(() => currentTime);
    let currentTime = 0;

    const fixture = createComponent(StandaloneDraggable);
    fixture.componentInstance.dragStartDelay.set(1000);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform, "Expected element not to be moved by default.").toBeFalsy();

    startDraggingViaMouse(fixture, dragElement);
    currentTime += 750;
    dispatchMouseEvent(document, "mousemove", 50, 100);
    currentTime += 500;
    fixture.detectChanges();

    expect(dragElement.style.transform, "Expected element not to be moved if the mouse moved before the delay.").toBeFalsy();
  });

  it("should enable native drag interactions if mouse moves before the delay", async () => {
    // We can't use Jasmine's `clock` because Zone.js interferes with it.
    spyOn(Date, "now").and.callFake(() => currentTime);
    let currentTime = 0;

    const fixture = createComponent(StandaloneDraggable);
    fixture.componentInstance.dragStartDelay.set(1000);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;
    const styles = dragElement.style;

    expect(dragElement.style.transform, "Expected element not to be moved by default.").toBeFalsy();

    startDraggingViaMouse(fixture, dragElement);
    currentTime += 750;
    dispatchMouseEvent(document, "mousemove", 50, 100);
    currentTime += 500;
    fixture.detectChanges();

    expect(styles.touchAction || (styles as any).webkitUserDrag).toBeFalsy();
  });

  it("should allow dragging after the drag start delay is elapsed", () => {
    // We can't use Jasmine's `clock` because Zone.js interferes with it.
    spyOn(Date, "now").and.callFake(() => currentTime);
    let currentTime = 0;

    const fixture = createComponent(StandaloneDraggable);
    fixture.componentInstance.dragStartDelay.set(500);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform, "Expected element not to be moved by default.").toBeFalsy();

    dispatchMouseEvent(dragElement, "mousedown");
    fixture.detectChanges();
    currentTime += 750;

    // The first `mousemove` here starts the sequence and the second one moves the element.
    dispatchMouseEvent(document, "mousemove", 50, 100);
    dispatchMouseEvent(document, "mousemove", 50, 100);
    fixture.detectChanges();

    expect(dragElement.style.transform, "Expected element to be dragged after all the time has passed.").toBe("translate3d(50px, 100px, 0px)");
  });

  it("should not prevent the default touch action before the delay has elapsed", async () => {
    spyOn(Date, "now").and.callFake(() => currentTime);
    let currentTime = 0;

    const fixture = createComponent(StandaloneDraggable);
    fixture.componentInstance.dragStartDelay.set(500);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform, "Expected element not to be moved by default.").toBeFalsy();

    dispatchTouchEvent(dragElement, "touchstart");
    fixture.detectChanges();
    currentTime += 250;

    expect(dispatchTouchEvent(document, "touchmove", 50, 100).defaultPrevented).toBe(false);
  });

  it("should handle the drag delay as a string", () => {
    // We can't use Jasmine's `clock` because Zone.js interferes with it.
    spyOn(Date, "now").and.callFake(() => currentTime);
    let currentTime = 0;

    const fixture = createComponent(StandaloneDraggable);
    fixture.componentInstance.dragStartDelay.set("500" as any);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform, "Expected element not to be moved by default.").toBeFalsy();

    dispatchMouseEvent(dragElement, "mousedown");
    fixture.detectChanges();
    currentTime += 750;

    // The first `mousemove` here starts the sequence and the second one moves the element.
    dispatchMouseEvent(document, "mousemove", 50, 100);
    dispatchMouseEvent(document, "mousemove", 50, 100);
    fixture.detectChanges();

    expect(dragElement.style.transform, "Expected element to be dragged after all the time has passed.").toBe("translate3d(50px, 100px, 0px)");
  });

  it("should be able to configure the drag start delay based on the event type", () => {
    // We can't use Jasmine's `clock` because Zone.js interferes with it.
    spyOn(Date, "now").and.callFake(() => currentTime);
    let currentTime = 0;

    const fixture = createComponent(StandaloneDraggable);
    fixture.componentInstance.dragStartDelay.set({ touch: 500, mouse: 0 });
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform, "Expected element not to be moved by default.").toBeFalsy();

    dragElementViaTouch(fixture, dragElement, 50, 100);
    expect(dragElement.style.transform, "Expected element not to be moved via touch because it has a delay.").toBeFalsy();

    dragElementViaMouse(fixture, dragElement, 50, 100);
    expect(dragElement.style.transform, "Expected element to be moved via mouse because it has no delay.").toBe("translate3d(50px, 100px, 0px)");
  });

  it("should be able to get the current position", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();

    const dragElement = fixture.componentInstance.dragElement.nativeElement;
    const dragInstance = fixture.componentInstance.dragInstance;

    expect(dragInstance.getFreeDragPosition()).toEqual({ x: 0, y: 0 });

    dragElementViaMouse(fixture, dragElement, 50, 100);
    expect(dragInstance.getFreeDragPosition()).toEqual({ x: 50, y: 100 });

    dragElementViaMouse(fixture, dragElement, 100, 200);
    expect(dragInstance.getFreeDragPosition()).toEqual({ x: 150, y: 300 });
  });

  it("should be able to set the current position programmatically", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();

    const dragElement = fixture.componentInstance.dragElement.nativeElement;
    const dragInstance = fixture.componentInstance.dragInstance;

    dragInstance.setFreeDragPosition({ x: 50, y: 100 });

    expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");
    expect(dragInstance.getFreeDragPosition()).toEqual({ x: 50, y: 100 });
  });

  it("should be able to set the current position", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.componentInstance.freeDragPosition.set({ x: 50, y: 100 });
    fixture.detectChanges();

    const dragElement = fixture.componentInstance.dragElement.nativeElement;
    const dragInstance = fixture.componentInstance.dragInstance;

    expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");
    expect(dragInstance.getFreeDragPosition()).toEqual({ x: 50, y: 100 });
  });

  it("should be able to get the up-to-date position as the user is dragging", async () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();

    const dragElement = fixture.componentInstance.dragElement.nativeElement;
    const dragInstance = fixture.componentInstance.dragInstance;

    expect(dragInstance.getFreeDragPosition()).toEqual({ x: 0, y: 0 });

    startDraggingViaMouse(fixture, dragElement);
    dispatchMouseEvent(document, "mousemove", 50, 100);
    fixture.detectChanges();

    expect(dragInstance.getFreeDragPosition()).toEqual({ x: 50, y: 100 });

    dispatchMouseEvent(document, "mousemove", 100, 200);
    fixture.detectChanges();

    expect(dragInstance.getFreeDragPosition()).toEqual({ x: 100, y: 200 });
  });

  it("should react to changes in the free drag position", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.componentInstance.freeDragPosition.set({ x: 50, y: 100 });
    fixture.detectChanges();

    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");

    fixture.componentInstance.freeDragPosition.set({ x: 100, y: 200 });
    fixture.detectChanges();

    expect(dragElement.style.transform).toBe("translate3d(100px, 200px, 0px)");
  });

  it("should be able to continue dragging after the current position was set", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.componentInstance.freeDragPosition.set({ x: 50, y: 100 });
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");

    dragElementViaMouse(fixture, dragElement, 100, 200);

    expect(dragElement.style.transform).toBe("translate3d(150px, 300px, 0px)");
  });

  it("should account for the scale when setting the free drag position", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.componentInstance.scale.set(0.5);
    fixture.componentInstance.freeDragPosition.set({ x: 50, y: 100 });
    fixture.detectChanges();

    const dragElement = fixture.componentInstance.dragElement.nativeElement;
    const dragInstance = fixture.componentInstance.dragInstance;

    expect(dragElement.style.transform).toBe("translate3d(100px, 200px, 0px)");
    expect(dragInstance.getFreeDragPosition()).toEqual({ x: 50, y: 100 });
  });

  it("should include the dragged distance as the user is dragging", async () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;
    const spy = jasmine.createSpy("moved spy");
    const subscription = fixture.componentInstance.dragInstance.moved.subscribe(spy);

    startDraggingViaMouse(fixture, dragElement);

    dispatchMouseEvent(document, "mousemove", 50, 100);
    fixture.detectChanges();

    let event = spy.calls.mostRecent().args[0];
    expect(event.distance).toEqual({ x: 50, y: 100 });

    dispatchMouseEvent(document, "mousemove", 75, 50);
    fixture.detectChanges();

    event = spy.calls.mostRecent().args[0];
    expect(event.distance).toEqual({ x: 75, y: 50 });

    subscription.unsubscribe();
  });

  it("should be able to configure the drag input defaults through a provider", () => {
    const config: DragDropConfig = {
      draggingDisabled: true,
      dragStartDelay: 1337,
      lockAxis: "y",
      constrainPosition: () => ({ x: 1337, y: 42 }),
      previewClass: "custom-preview-class",
      boundaryElement: ".boundary",
      rootElementSelector: ".root",
      previewContainer: "parent",
    };

    const fixture = createComponent(PlainStandaloneDraggable, { dragConfig: config });
    fixture.detectChanges();
    const drag = fixture.componentInstance.dragInstance;
    expect(drag.disabled).toBe(true);
    expect(drag.dragStartDelay).toBe(1337);
    expect(drag.lockAxis).toBe("y");
    expect(drag.constrainPosition).toBe(config.constrainPosition);
    expect(drag.previewClass).toBe("custom-preview-class");
    expect(drag.boundaryElement).toBe(".boundary");
    expect(drag.rootElementSelector).toBe(".root");
    expect(drag.previewContainer).toBe("parent");
  });

  it("should not throw if touches and changedTouches are empty", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    startDraggingViaTouch(fixture, dragElement);
    continueDraggingViaTouch(fixture, 50, 100);

    expect(() => {
      const event = createTouchEvent("touchend", 50, 100);
      Object.defineProperties(event, {
        touches: { get: () => [] },
        changedTouches: { get: () => [] },
      });

      dispatchEvent(document, event);
      fixture.detectChanges();
    }).not.toThrow();
  });

  it("should update the free drag position if the page is scrolled", async () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();

    const cleanup = makeScrollable();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform).toBeFalsy();
    startDraggingViaMouse(fixture, dragElement, 0, 0);
    dispatchMouseEvent(document, "mousemove", 50, 100);
    fixture.detectChanges();

    expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");

    scrollTo(0, 500);
    dispatchFakeEvent(document, "scroll");
    fixture.detectChanges();
    expect(dragElement.style.transform).toBe("translate3d(50px, 600px, 0px)");

    cleanup();
  });

  it("should update the free drag position if the user moves their pointer after the page is scrolled", async () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.detectChanges();

    const cleanup = makeScrollable();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform).toBeFalsy();
    startDraggingViaMouse(fixture, dragElement, 0, 0);
    dispatchMouseEvent(document, "mousemove", 50, 100);
    fixture.detectChanges();

    expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");

    scrollTo(0, 500);
    dispatchFakeEvent(document, "scroll");
    fixture.detectChanges();
    dispatchMouseEvent(document, "mousemove", 50, 200);
    fixture.detectChanges();

    expect(dragElement.style.transform).toBe("translate3d(50px, 700px, 0px)");

    cleanup();
  });

  it("should account for scale when moving the element", () => {
    const fixture = createComponent(StandaloneDraggable);
    fixture.componentInstance.scale.set(0.5);
    fixture.detectChanges();
    const dragElement = fixture.componentInstance.dragElement.nativeElement;

    expect(dragElement.style.transform).toBeFalsy();
    dragElementViaMouse(fixture, dragElement, 50, 100);
    expect(dragElement.style.transform).toBe("translate3d(100px, 200px, 0px)");
  });

  describe("with a handle", () => {
    it("should not be able to drag the entire element if it has a handle", () => {
      const fixture = createComponent(StandaloneDraggableWithHandle);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;

      expect(dragElement.style.transform).toBeFalsy();
      dragElementViaMouse(fixture, dragElement, 50, 100);
      expect(dragElement.style.transform).toBeFalsy();
    });

    it("should be able to drag an element using its handle", () => {
      const fixture = createComponent(StandaloneDraggableWithHandle);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const handle = fixture.componentInstance.handleElement.nativeElement;

      expect(dragElement.style.transform).toBeFalsy();
      dragElementViaMouse(fixture, handle, 50, 100);
      expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");
    });

    it("should not be able to drag the element if the handle is disabled", () => {
      const fixture = createComponent(StandaloneDraggableWithHandle);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const handle = fixture.componentInstance.handleElement.nativeElement;

      fixture.componentInstance.handleInstance.disabled = true;

      expect(dragElement.style.transform).toBeFalsy();
      dragElementViaMouse(fixture, handle, 50, 100);
      expect(dragElement.style.transform).toBeFalsy();
    });

    it("should not be able to drag the element if the handle is disabled before init", () => {
      const fixture = createComponent(StandaloneDraggableWithPreDisabledHandle);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const handle = fixture.componentInstance.handleElement.nativeElement;

      expect(dragElement.style.transform).toBeFalsy();
      dragElementViaMouse(fixture, handle, 50, 100);
      expect(dragElement.style.transform).toBeFalsy();
    });

    it("should not be able to drag using the handle if the element is disabled", () => {
      const fixture = createComponent(StandaloneDraggableWithHandle);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const handle = fixture.componentInstance.handleElement.nativeElement;

      fixture.componentInstance.draggingDisabled.set(true);
      fixture.detectChanges();

      expect(dragElement.style.transform).toBeFalsy();
      dragElementViaMouse(fixture, handle, 50, 100);
      expect(dragElement.style.transform).toBeFalsy();
    });

    it("should be able to use a handle that was added after init", () => {
      const fixture = createComponent(StandaloneDraggableWithDelayedHandle);

      fixture.detectChanges();
      fixture.componentInstance.showHandle.set(true);
      fixture.detectChanges();

      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const handle = fixture.componentInstance.handleElement.nativeElement;

      expect(dragElement.style.transform).toBeFalsy();
      dragElementViaMouse(fixture, handle, 50, 100);
      expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");
    });

    it("should be able to use more than one handle to drag the element", () => {
      const fixture = createComponent(StandaloneDraggableWithMultipleHandles);
      fixture.detectChanges();

      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const handles = fixture.componentInstance.handles.map((handle) => handle.element.nativeElement);

      expect(dragElement.style.transform).toBeFalsy();
      dragElementViaMouse(fixture, handles[1], 50, 100);
      expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");

      dragElementViaMouse(fixture, handles[0], 100, 200);
      expect(dragElement.style.transform).toBe("translate3d(150px, 300px, 0px)");
    });

    it("should be able to drag with a handle that is not a direct descendant", () => {
      const fixture = createComponent(StandaloneDraggableWithIndirectHandle);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const handle = fixture.componentInstance.handleElement.nativeElement;

      expect(dragElement.style.transform).toBeFalsy();
      dragElementViaMouse(fixture, dragElement, 50, 100);

      expect(dragElement.style.transform, "Expected not to be able to drag the element by itself.").toBeFalsy();

      dragElementViaMouse(fixture, handle, 50, 100);
      expect(dragElement.style.transform, "Expected to drag the element by its handle.").toBe("translate3d(50px, 100px, 0px)");
    });

    it("should be able to drag with a handle that is defined in a separate embedded view", () => {
      const fixture = createComponent(StandaloneDraggableWithExternalTemplateHandle);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const handle = fixture.nativeElement.querySelector(".handle")!;

      expect(dragElement.style.transform).toBeFalsy();
      dragElementViaMouse(fixture, dragElement, 50, 100);

      expect(dragElement.style.transform, "Expected not to be able to drag the element by itself.").toBeFalsy();

      dragElementViaMouse(fixture, handle, 50, 100);
      expect(dragElement.style.transform, "Expected to drag the element by its handle.").toBe("translate3d(50px, 100px, 0px)");
    });

    it("should disable the tap highlight while dragging via the handle", () => {
      // This test is irrelevant if the browser doesn't support styling the tap highlight color.
      if (!("webkitTapHighlightColor" in document.body.style)) {
        return;
      }

      const fixture = createComponent(StandaloneDraggableWithHandle);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const handle = fixture.componentInstance.handleElement.nativeElement;

      expect((dragElement.style as any).webkitTapHighlightColor).toBeFalsy();

      startDraggingViaMouse(fixture, handle);

      expect((dragElement.style as any).webkitTapHighlightColor).toBe("transparent");

      dispatchMouseEvent(document, "mousemove", 50, 100);
      fixture.detectChanges();

      dispatchMouseEvent(document, "mouseup", 50, 100);
      fixture.detectChanges();

      expect((dragElement.style as any).webkitTapHighlightColor).toBeFalsy();
    });

    it("should preserve any existing `webkitTapHighlightColor`", () => {
      // This test is irrelevant if the browser doesn't support styling the tap highlight color.
      if (!("webkitTapHighlightColor" in document.body.style)) {
        return;
      }

      const fixture = createComponent(StandaloneDraggableWithHandle);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const handle = fixture.componentInstance.handleElement.nativeElement;

      (dragElement.style as any).webkitTapHighlightColor = "purple";

      startDraggingViaMouse(fixture, handle);

      expect((dragElement.style as any).webkitTapHighlightColor).toBe("transparent");

      dispatchMouseEvent(document, "mousemove", 50, 100);
      fixture.detectChanges();

      dispatchMouseEvent(document, "mouseup", 50, 100);
      fixture.detectChanges();

      expect((dragElement.style as any).webkitTapHighlightColor).toBe("purple");
    });

    it.skip("should throw if drag handle is attached to an ng-container", () => {
      // ng-container: `<DragHandle>` always renders an element (see the header).
    });

    it("should be able to drag an element using a handle with a shadow DOM child", () => {
      if (!supportsShadowDom()) {
        return;
      }

      const fixture = createComponent(StandaloneDraggableWithShadowInsideHandle);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.dragElement.nativeElement;
      const handleChild = fixture.componentInstance.handleChild.nativeElement;

      expect(dragElement.style.transform).toBeFalsy();
      dragElementViaMouse(fixture, handleChild, 50, 100);
      expect(dragElement.style.transform).toBe("translate3d(50px, 100px, 0px)");
    });

    it("should prevent default dragStart on handle, not on entire draggable", () => {
      const fixture = createComponent(StandaloneDraggableWithHandle);
      fixture.detectChanges();

      const draggableEvent = dispatchFakeEvent(fixture.componentInstance.dragElement.nativeElement, "dragstart");
      fixture.detectChanges();

      const handleEvent = dispatchFakeEvent(fixture.componentInstance.handleElement.nativeElement, "dragstart", true);
      fixture.detectChanges();

      expect(draggableEvent.defaultPrevented).toBe(false);
      expect(handleEvent.defaultPrevented).toBe(true);
    });
  });
});

class StandaloneDraggable extends TestComponent {
  get dragElement() {
    return { nativeElement: this.query("#dragElement") };
  }
  get dragInstance(): DragInstance {
    return dragInstance(this.dragElement.nativeElement)!;
  }
  startedSpy = jasmine.createSpy("started spy");
  endedSpy = jasmine.createSpy("ended spy");
  releasedSpy = jasmine.createSpy("released spy");
  boundary = signal<string | HTMLElement | undefined>(undefined);
  dragStartDelay = signal<DragStartDelay | undefined>(undefined);
  constrainPosition: ((userPointerPosition: Point, dragRef: DragRef, dimensions: DOMRect, pickupPositionInElement: Point) => Point) | undefined;
  freeDragPosition = signal<{ x: number; y: number } | undefined>(undefined);
  dragDisabled = signal(false);
  dragLockAxis = signal<DragAxis | null>(null);
  scale = signal(1);

  view() {
    const instance = this;
    return (
      <div class="wrapper" style={{ width: "200px", height: "200px", background: "green" }}>
        <Drag
          id="dragElement"
          boundaryElement={instance.boundary}
          dragStartDelay={instance.dragStartDelay}
          constrainPosition={instance.constrainPosition}
          freeDragPosition={instance.freeDragPosition}
          disabled={instance.dragDisabled}
          lockAxis={instance.dragLockAxis}
          scale={instance.scale}
          onStarted={(event) => instance.startedSpy(event)}
          onReleased={(event) => instance.releasedSpy(event)}
          onEnded={(event) => instance.endedSpy(event)}
          style={{ width: "100px", height: "100px", background: "red" }}
        />
      </div>
    );
  }
}

class StandaloneDraggableWithOnPush extends TestComponent {
  get dragElement() {
    return { nativeElement: this.query("#dragElement") };
  }
  get dragInstance(): DragInstance {
    return dragInstance(this.dragElement.nativeElement)!;
  }

  view() {
    return <Drag id="dragElement" style={{ width: "100px", height: "100px", background: "red" }} />;
  }
}

class StandaloneDraggableWithHandle extends TestComponent {
  get dragElement() {
    return { nativeElement: this.query("#dragElement") };
  }
  get handleElement() {
    return { nativeElement: this.query("#handleElement") };
  }
  get dragInstance(): DragInstance {
    return dragInstance(this.dragElement.nativeElement)!;
  }
  /** `@ViewChild(CdkDragHandle)`: its `disabled` input is the `handleDisabled` signal. */
  get handleInstance(): { disabled: boolean } {
    const disabled = this.handleDisabled;
    return {
      get disabled() {
        return disabled();
      },
      set disabled(value: boolean) {
        disabled.set(value);
      },
    };
  }
  handleDisabled = signal(false);
  draggingDisabled = signal(false);

  view() {
    return (
      <Drag id="dragElement" disabled={this.draggingDisabled} style={{ width: "100px", height: "100px", background: "red", position: "relative" }}>
        <DragHandle id="handleElement" disabled={this.handleDisabled} style={{ width: "10px", height: "10px", background: "green" }} />
      </Drag>
    );
  }
}

class StandaloneDraggableWithPreDisabledHandle extends TestComponent {
  get dragElement() {
    return { nativeElement: this.query("#dragElement") };
  }
  get handleElement() {
    return { nativeElement: this.query("#handleElement") };
  }
  get dragInstance(): DragInstance {
    return dragInstance(this.dragElement.nativeElement)!;
  }
  disableHandle = true;

  view() {
    return (
      <Drag id="dragElement" style={{ width: "100px", height: "100px", background: "red", position: "relative" }}>
        <DragHandle id="handleElement" disabled={this.disableHandle} style={{ width: "10px", height: "10px", background: "green" }} />
      </Drag>
    );
  }
}

class StandaloneDraggableWithDelayedHandle extends TestComponent {
  get dragElement() {
    return { nativeElement: this.query("#dragElement") };
  }
  get handleElement() {
    return { nativeElement: this.query("#handleElement") };
  }
  showHandle = signal(false);

  view() {
    return (
      <Drag id="dragElement" style={{ width: "100px", height: "100px", background: "red", position: "relative" }}>
        <Show when={() => this.showHandle()}>{() => <DragHandle id="handleElement" style={{ width: "10px", height: "10px", background: "green" }} />}</Show>
      </Drag>
    );
  }
}

/**
 * Component that passes through whatever content is projected into it.
 * Used to test having drag elements being projected into a component.
 */
function PassthroughComponent(props: { children?: Content }) {
  return <div class="passthrough-component">{props.children}</div>;
}

class StandaloneDraggableWithIndirectHandle extends TestComponent {
  get dragElement() {
    return { nativeElement: this.query("#dragElement") };
  }
  get handleElement() {
    return { nativeElement: this.query("#handleElement") };
  }

  view() {
    return (
      <Drag id="dragElement" style={{ width: "100px", height: "100px", background: "red", position: "relative" }}>
        <PassthroughComponent>
          <DragHandle id="handleElement" style={{ width: "10px", height: "10px", background: "green" }} />
        </PassthroughComponent>
      </Drag>
    );
  }
}

/** `<shadow-wrapper>` with `ViewEncapsulation.ShadowDom`: its projected content renders inside its shadow root. */
function ShadowWrapper(props: { children?: Content }) {
  const children = props.children;
  const host = document.createElement("shadow-wrapper");
  const root = host.attachShadow({ mode: "open" });
  onCleanup(mount(() => children as never, root as unknown as DocumentFragment));
  return host as never;
}

class StandaloneDraggableWithShadowInsideHandle extends TestComponent {
  get dragElement() {
    return { nativeElement: this.query("#dragElement") };
  }
  get handleChild() {
    return { nativeElement: this.query("shadow-wrapper").shadowRoot!.querySelector<HTMLElement>("#handleChild")! };
  }

  view() {
    return (
      <Drag id="dragElement" style={{ width: "100px", height: "100px", background: "red" }}>
        <DragHandle style={{ width: "10px", height: "10px" }}>
          <ShadowWrapper>
            <div id="handleChild" style={{ width: "10px", height: "10px", background: "green" }} />
          </ShadowWrapper>
        </DragHandle>
      </Drag>
    );
  }
}

class StandaloneDraggableWithMultipleHandles extends TestComponent {
  get dragElement() {
    return { nativeElement: this.query("#dragElement") };
  }
  /** `@ViewChildren(CdkDragHandle)`. */
  get handles() {
    return this.queryAll(".cdk-drag-handle").map((element) => ({ element: { nativeElement: element } }));
  }

  view() {
    // `ViewEncapsulation.None` component styles (the compiler takes no `<style>` JSX content).
    const styles = document.createElement("style");
    styles.textContent = `
      .cdk-drag-handle {
        position: absolute;
        top: 0;
        background: green;
        width: 10px;
        height: 10px;
      }
    `;
    return (
      <>
        {styles as never}
        <Drag id="dragElement" style={{ width: "100px", height: "100px", background: "red", position: "relative" }}>
          <DragHandle style={{ left: "0" }} />
          <DragHandle style={{ right: "0" }} />
        </Drag>
      </>
    );
  }
}

class DraggableWithAlternateRoot extends TestComponent {
  get dragElement() {
    return { nativeElement: this.query("#dragElement") };
  }
  get dragRoot() {
    return { nativeElement: this.query("#dragRoot") };
  }
  get dragInstance(): DragInstance {
    return dragInstance(this.dragElement.nativeElement)!;
  }
  rootElementSelector = signal<string | undefined>(undefined);

  view() {
    return (
      <div id="dragRoot" class="alternate-root" style={{ width: "200px", height: "200px", background: "hotpink" }}>
        <Drag id="dragElement" rootElementSelector={this.rootElementSelector} style={{ width: "100px", height: "100px", background: "red" }} />
      </div>
    );
  }
}

class DraggableWithAlternateRootAndSelfHandle extends TestComponent {
  get dragElement() {
    return { nativeElement: this.query("#dragElement") };
  }
  get dragRoot() {
    return { nativeElement: this.query("#dragRoot") };
  }
  get dragInstance(): DragInstance {
    return dragInstance(this.dragElement.nativeElement)!;
  }

  view() {
    return (
      <div id="dragRoot" class="alternate-root" style={{ width: "200px", height: "200px", background: "hotpink" }}>
        <Drag id="dragElement" rootElementSelector=".alternate-root" isHandle style={{ width: "100px", height: "100px", background: "red" }} />
      </div>
    );
  }
}

/** Upstream `<ng-container cdkDrag cdkDragRootElement=".alternate-root">`: the `<Drag>` renders an element around the content. */
class DraggableNgContainerWithAlternateRoot extends TestComponent {
  get dragRoot() {
    return { nativeElement: this.query("#dragRoot") };
  }
  get dragInstance(): DragInstance {
    return dragInstance(this.query(".cdk-drag"))!;
  }

  view() {
    return (
      <div id="dragRoot" class="alternate-root" style={{ width: "200px", height: "200px", background: "hotpink" }}>
        <Drag rootElementSelector=".alternate-root">
          <div style={{ width: "100px", height: "100px", background: "red" }} />
        </Drag>
      </div>
    );
  }
}

class PlainStandaloneDraggable extends TestComponent {
  get dragInstance(): DragInstance {
    return dragInstance(this.query(".cdk-drag"))!;
  }

  view() {
    return <Drag />;
  }
}

class StandaloneDraggableWithExternalTemplateHandle extends TestComponent {
  get dragElement() {
    return { nativeElement: this.query("#dragElement") };
  }

  view() {
    // `<ng-template #template>` rendered through `ngTemplateOutlet` inside the drag element.
    const template = () => <DragHandle class="handle" style={{ width: "10px", height: "10px", background: "green" }} />;
    return (
      <Drag id="dragElement" style={{ width: "100px", height: "100px", background: "red", position: "relative" }}>
        {template()}
      </Drag>
    );
  }
}

class DragWithResizeableBoundary extends TestComponent {
  get boundaryElement() {
    return { nativeElement: this.query("#boundaryElement") };
  }
  get dragElement() {
    return { nativeElement: this.query("#dragElement") };
  }
  get dragInstance(): DragInstance {
    return dragInstance(this.dragElement.nativeElement)!;
  }

  setBoundary(height: string, width: string) {
    this.boundaryElement.nativeElement.style.height = height;
    this.boundaryElement.nativeElement.style.width = width;
  }

  view() {
    return (
      <div id="boundaryElement" class="example-boundary" style={{ width: "400px", height: "400px" }}>
        <Drag id="dragElement" class="example-box" boundaryElement=".example-boundary" style={{ width: "100px", height: "100px" }}>
          I can only be dragged within the container
        </Drag>
      </div>
    );
  }
}
