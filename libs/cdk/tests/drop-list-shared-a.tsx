// Ported from Angular Components (src/cdk/drag-drop/directives/drop-list-shared.spec.ts — the setup of
// `defineCommonDropListTests` and its "in a drop container" block), MIT, © Google LLC.
// Changes:
// - fixtures from drop-list-fixtures.tsx (Rivet TSX views, see its header); `@ViewChildren` /
//   `@ViewChild` instances expose `.element` as the `HTMLElement` (`element.nativeElement` → `element`);
// - `fixture.changeDetectorRef.markForCheck()` → `fixture.componentInstance.markForCheck()`,
//   `fixture.whenStable()` → `wait(0)` (pending drop animations / cleanups settle in a task);
// - `providers: [provideFakeDirectionality('rtl')]` → `{dir: 'rtl'}`; `CDK_DRAG_CONFIG` providers →
//   `{dragConfig}` (merged over the test defaults); `encapsulation: ViewEncapsulation.ShadowDom` →
//   `fixture.componentInstance.encapsulation = 'shadow-dom'` before the first `detectChanges()`;
// - `getViewportRuler()` → `viewportRuler()`, `TestBed.inject(Platform)` → `getPlatform()`;
// - `jasmine.spyOnGlobalErrorsAsync` → a local `spyOnGlobalErrorsAsync` (window `error` /
//   `unhandledrejection` listener); Jasmine globals from `@rivetjs/testing/jasmine`;
// - in-place array mutations (`items.push(...)`) re-render on `markForCheck()` (upstream calls it there).
import { describe, expect, it, jasmine, spyOn, type Spy } from "@rivetjs/testing/jasmine";
import { createTouchEvent, dispatchEvent, dispatchFakeEvent, dispatchMouseEvent, dispatchTouchEvent } from "@rivetjs/testing/fake-events";
import { _supportsShadowDom, getPlatform } from "../platform/index.ts";
import { viewportRuler as getViewportRuler } from "../scrolling/viewport-ruler.ts";
import { DragRef, type DragDrop, type DragDropConfig, type DragStart, type Point, type PreviewContainer } from "../drag-drop/index.tsx";
import {
  createComponent as _createComponent,
  dragElementViaMouse,
  makeScrollable,
  startDraggingViaMouse,
  wait,
  type ComponentFixture,
  type DragDropTestConfig,
  type TestComponent,
} from "./drag-test-utils.tsx";
import {
  DraggableInDropZone,
  DraggableInDropZoneWithContainer,
  DraggableInDropZoneWithCustomMultiNodePlaceholder,
  DraggableInDropZoneWithCustomMultiNodePreview,
  DraggableInDropZoneWithCustomPlaceholder,
  DraggableInDropZoneWithCustomPreview,
  DraggableInDropZoneWithCustomTextOnlyPlaceholder,
  DraggableInDropZoneWithCustomTextOnlyPreview,
  DraggableInDropZoneWithoutEvents,
  DraggableInOnPushDropZone,
  DraggableInScrollableParentContainer,
  DraggableInScrollableVerticalDropZone,
  DraggableWithCanvasInDropZone,
  DraggableWithInputsInDropZone,
  DraggableWithInvalidCanvasInDropZone,
  DraggableWithRadioInputsInDropZone,
  ConnectedDropZonesViaGroupDirective,
  DropListOnNgContainer,
  ITEM_HEIGHT,
  NestedDropZones,
  PlainStandaloneDropList,
  assertEndToStartSorting,
  assertStartToEndSorting,
  getHorizontalFixtures,
} from "./drop-list-fixtures.tsx";
import type { CommonDropListTestsConfig } from "./drop-list-shared.tsx";

/** Jasmine `spyOnGlobalErrorsAsync`: a spy called with every uncaught error while `fn` runs. */
async function spyOnGlobalErrorsAsync(fn: (globalErrorSpy: Spy) => Promise<void>): Promise<void> {
  const globalErrorSpy = jasmine.createSpy("global error spy");
  const onError = (event: ErrorEvent) => {
    event.preventDefault();
    globalErrorSpy(event.error);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    event.preventDefault();
    globalErrorSpy(event.reason);
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  try {
    await fn(globalErrorSpy);
  } finally {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  }
}

export function defineCommonDropListTestsA(config: CommonDropListTestsConfig) {
  const { DraggableInHorizontalDropZone, DraggableInScrollableHorizontalDropZone, DraggableInHorizontalFlexDropZoneWithMatchSizePreview } =
    getHorizontalFixtures(config.horizontalListOrientation);

  function createComponent<T extends TestComponent>(type: new () => T, testConfig: DragDropTestConfig = {}): ComponentFixture<T> {
    return _createComponent(type, { ...testConfig, listOrientation: config.verticalListOrientation });
  }

  describe("in a drop container", () => {
    it("should be able to attach data to the drop container", () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();

      expect(fixture.componentInstance.dropInstance.data).toBe(fixture.componentInstance.items);
    });

    it("should register an item with the drop container", () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const list = fixture.componentInstance.dropInstance;

      spyOn(list, "addItem").and.callThrough();

      fixture.componentInstance.items.push({ value: "Extra", margin: 0, height: ITEM_HEIGHT });
      fixture.componentInstance.markForCheck();
      fixture.detectChanges();

      expect(list.addItem).toHaveBeenCalledTimes(1);
    });

    it("should remove an item from the drop container", () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const list = fixture.componentInstance.dropInstance;

      spyOn(list, "removeItem").and.callThrough();

      fixture.componentInstance.items.pop();
      fixture.componentInstance.markForCheck();
      fixture.detectChanges();

      expect(list.removeItem).toHaveBeenCalledTimes(1);
    });

    it("should return the items sorted by their position in the DOM", () => {
      const fixture = createComponent(DraggableInDropZone);
      const items = fixture.componentInstance.items;
      fixture.detectChanges();

      // Insert a couple of items in the start and the middle so the list gets shifted around.
      items.unshift({ value: "Extra 0", margin: 0, height: ITEM_HEIGHT });
      items.splice(3, 0, { value: "Extra 1", margin: 0, height: ITEM_HEIGHT });
      fixture.componentInstance.markForCheck();
      fixture.detectChanges();

      expect(
        fixture.componentInstance.dropInstance.getSortedItems().map((item) => {
          return item.element.textContent!.trim();
        }),
      ).toEqual(["Extra 0", "Zero", "One", "Extra 1", "Two", "Three"]);
    });

    it("should sync the drop list inputs with the drop list ref", () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();

      const dropInstance = fixture.componentInstance.dropInstance;
      const dropListRef = dropInstance._dropListRef;

      expect(dropListRef.lockAxis).toBeFalsy();
      expect(dropListRef.disabled).toBe(false);

      fixture.componentInstance.dropLockAxis.set("x");
      fixture.componentInstance.dropDisabled.set(true);
      fixture.detectChanges();

      dropListRef.beforeStarted.next();

      expect(dropListRef.lockAxis).toBe("x");
      expect(dropListRef.disabled).toBe(true);
    });

    it("should be able to attach data to a drag item", () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();

      expect(fixture.componentInstance.dragItems.first.data).toBe(fixture.componentInstance.items[0]);
    });

    it("should be able to overwrite the drop zone id", () => {
      const fixture = createComponent(DraggableInDropZone);

      fixture.componentInstance.dropZoneId = "custom-id";
      fixture.detectChanges();

      const drop = fixture.componentInstance.dropInstance;

      expect(drop.id).toBe("custom-id");
      expect(drop.element.getAttribute("id")).toBe("custom-id");
    });

    it("should toggle a class when the user starts dragging an item", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const dropZone = fixture.componentInstance.dropInstance;

      expect(dropZone.element.classList).not.toContain("cdk-drop-list-dragging");

      startDraggingViaMouse(fixture, item);

      expect(dropZone.element.classList).toContain("cdk-drop-list-dragging");

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
      fixture.detectChanges();

      expect(dropZone.element.classList).not.toContain("cdk-drop-dragging");
    });

    it("should toggle the drop dragging classes if there is nothing to trigger change detection", async () => {
      const fixture = createComponent(DraggableInDropZoneWithoutEvents);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const dropZone = fixture.componentInstance.dropInstance;

      expect(dropZone.element.classList).not.toContain("cdk-drop-list-dragging");
      expect(item.classList).not.toContain("cdk-drag-dragging");

      startDraggingViaMouse(fixture, item);

      expect(dropZone.element.classList).toContain("cdk-drop-list-dragging");
      expect(item.classList).toContain("cdk-drag-dragging");

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
      fixture.detectChanges();

      expect(dropZone.element.classList).not.toContain("cdk-drop-dragging");
      expect(item.classList).not.toContain("cdk-drag-dragging");
    });

    it("should toggle a class when the user starts dragging an item with OnPush change detection", async () => {
      const fixture = createComponent(DraggableInOnPushDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const dropZone = fixture.componentInstance.dropInstance;

      expect(dropZone.element.classList).not.toContain("cdk-drop-list-dragging");

      startDraggingViaMouse(fixture, item);

      expect(dropZone.element.classList).toContain("cdk-drop-list-dragging");

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
      fixture.detectChanges();

      expect(dropZone.element.classList).not.toContain("cdk-drop-dragging");
    });

    it("should not toggle dragging class if the element was not dragged more than the threshold", () => {
      const fixture = createComponent(DraggableInDropZone, { dragDistance: 5 });
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const dropZone = fixture.componentInstance.dropInstance;

      expect(dropZone.element.classList).not.toContain("cdk-drop-dragging");

      startDraggingViaMouse(fixture, item);

      expect(dropZone.element.classList).not.toContain("cdk-drop-dragging");
    });

    it("should dispatch the `dropped` event when an item has been dropped", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const dragItems = fixture.componentInstance.dragItems;

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);

      const firstItem = dragItems.first;
      const thirdItemRect = dragItems.toArray()[2].element.getBoundingClientRect();

      dragElementViaMouse(fixture, firstItem.element, thirdItemRect.left + 1, thirdItemRect.top + 1);
      await wait(0);
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      // Assert the event like this, rather than `toHaveBeenCalledWith`, because Jasmine will
      // go into an infinite loop trying to stringify the event, if the test fails.
      expect(event).toEqual({
        previousIndex: 0,
        currentIndex: 2,
        item: firstItem,
        container: fixture.componentInstance.dropInstance,
        previousContainer: fixture.componentInstance.dropInstance,
        isPointerOverContainer: true,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["One", "Two", "Zero", "Three"]);
    });

    it("should expose whether an item was dropped over a container", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const dragItems = fixture.componentInstance.dragItems;
      const firstItem = dragItems.first;
      const thirdItemRect = dragItems.toArray()[2].element.getBoundingClientRect();

      dragElementViaMouse(fixture, firstItem.element, thirdItemRect.left + 1, thirdItemRect.top + 1);
      await wait(0);
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);

      const event: DragDrop<any> = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      expect(event.isPointerOverContainer).toBe(true);
    });

    it("should expose the drag distance when an item is dropped", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const dragItems = fixture.componentInstance.dragItems;
      const firstItem = dragItems.first;

      dragElementViaMouse(fixture, firstItem.element, 50, 60);
      await wait(0);
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);

      const event: DragDrop<any> = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      expect(event.distance).toEqual({ x: 50, y: 60 });
      expect(event.dropPoint).toEqual({ x: 50, y: 60 });
    });

    it("should expose whether an item was dropped outside of a container", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const dragItems = fixture.componentInstance.dragItems;
      const firstItem = dragItems.first;
      const containerRect = fixture.componentInstance.dropInstance.element.getBoundingClientRect();

      dragElementViaMouse(fixture, firstItem.element, containerRect.right + 10, containerRect.bottom + 10);
      await wait(0);
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);

      const event: DragDrop<any> = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      expect(event.isPointerOverContainer).toBe(false);
    });

    it("should dispatch the `sorted` event as an item is being sorted", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();

      const items = fixture.componentInstance.dragItems.map((item) => item.element);
      const draggedItem = items[0];
      const { top, left } = draggedItem.getBoundingClientRect();

      startDraggingViaMouse(fixture, draggedItem, left, top);

      // Drag over each item one-by-one going downwards.
      for (let i = 1; i < items.length; i++) {
        const elementRect = items[i].getBoundingClientRect();

        dispatchMouseEvent(document, "mousemove", elementRect.left, elementRect.top + 5);
        fixture.detectChanges();

        expect(fixture.componentInstance.sortedSpy.calls.mostRecent().args[0]).toEqual({
          previousIndex: i - 1,
          currentIndex: i,
          item: fixture.componentInstance.dragItems.first,
          container: fixture.componentInstance.dropInstance,
        });
      }

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
    });

    it("should not dispatch the `sorted` event when an item is dragged inside a single-item list", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.componentInstance.items = [fixture.componentInstance.items[0]];
      fixture.detectChanges();

      const draggedItem = fixture.componentInstance.dragItems.first.element;
      const { top, left } = draggedItem.getBoundingClientRect();

      startDraggingViaMouse(fixture, draggedItem, left, top);

      for (let i = 0; i < 5; i++) {
        dispatchMouseEvent(document, "mousemove", left, top + 1);
        fixture.detectChanges();

        expect(fixture.componentInstance.sortedSpy).not.toHaveBeenCalled();
      }

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
    });

    it("should not move items in a vertical list if the pointer is too far away", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const dragItems = fixture.componentInstance.dragItems;

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);

      const firstItem = dragItems.first;
      const thirdItemRect = dragItems.toArray()[2].element.getBoundingClientRect();

      // Move the cursor all the way to the right so it doesn't intersect along the x axis.
      dragElementViaMouse(fixture, firstItem.element, thirdItemRect.right + 1000, thirdItemRect.top + 1);
      await wait(0);
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      // Assert the event like this, rather than `toHaveBeenCalledWith`, because Jasmine will
      // go into an infinite loop trying to stringify the event, if the test fails.
      expect(event).toEqual({
        previousIndex: 0,
        currentIndex: 0,
        item: firstItem,
        container: fixture.componentInstance.dropInstance,
        previousContainer: fixture.componentInstance.dropInstance,
        isPointerOverContainer: false,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);
    });

    it("should not move the original element from its initial DOM position", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      let dragElements = Array.from(root.querySelectorAll(".cdk-drag"));

      expect(dragElements.map((el) => el.textContent)).toEqual(["Zero", "One", "Two", "Three"]);

      // Stub out the original call so the list doesn't get re-rendered.
      // We're testing the DOM order explicitly.
      fixture.componentInstance.droppedSpy.and.callFake(() => {});

      const thirdItemRect = dragElements[2].getBoundingClientRect();

      dragElementViaMouse(fixture, fixture.componentInstance.dragItems.first.element, thirdItemRect.left + 1, thirdItemRect.top + 1);
      await wait(0);
      fixture.detectChanges();

      dragElements = Array.from(root.querySelectorAll(".cdk-drag"));
      expect(dragElements.map((el) => el.textContent)).toEqual(["Zero", "One", "Two", "Three"]);
    });

    it("should dispatch the `dropped` event in a horizontal drop zone", async () => {
      const fixture = createComponent(DraggableInHorizontalDropZone);
      fixture.detectChanges();
      const dragItems = fixture.componentInstance.dragItems;

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);

      const firstItem = dragItems.first;
      const thirdItemRect = dragItems.toArray()[2].element.getBoundingClientRect();

      dragElementViaMouse(fixture, firstItem.element, thirdItemRect.left + 1, thirdItemRect.top + 1);
      await wait(0);
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      // Assert the event like this, rather than `toHaveBeenCalledWith`, because Jasmine will
      // go into an infinite loop trying to stringify the event, if the test fails.
      expect(event).toEqual({
        previousIndex: 0,
        currentIndex: 2,
        item: firstItem,
        container: fixture.componentInstance.dropInstance,
        previousContainer: fixture.componentInstance.dropInstance,
        isPointerOverContainer: true,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["One", "Two", "Zero", "Three"]);
    });

    it("should dispatch the correct `dropped` event in RTL horizontal drop zone", async () => {
      const fixture = createComponent(DraggableInHorizontalDropZone, { dir: "rtl" });

      fixture.nativeElement.setAttribute("dir", "rtl");
      fixture.detectChanges();
      const dragItems = fixture.componentInstance.dragItems;

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);

      const firstItem = dragItems.first;
      const thirdItemRect = dragItems.toArray()[2].element.getBoundingClientRect();

      dragElementViaMouse(fixture, firstItem.element, thirdItemRect.right - 1, thirdItemRect.top + 1);
      await wait(0);
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      // Assert the event like this, rather than `toHaveBeenCalledWith`, because Jasmine will
      // go into an infinite loop trying to stringify the event, if the test fails.
      expect(event).toEqual({
        previousIndex: 0,
        currentIndex: 2,
        item: firstItem,
        container: fixture.componentInstance.dropInstance,
        previousContainer: fixture.componentInstance.dropInstance,
        isPointerOverContainer: true,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["One", "Two", "Zero", "Three"]);
    });

    it("should not move items in a horizontal list if pointer is too far away", async () => {
      const fixture = createComponent(DraggableInHorizontalDropZone);
      fixture.detectChanges();
      const dragItems = fixture.componentInstance.dragItems;

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);

      const firstItem = dragItems.first;
      const thirdItemRect = dragItems.toArray()[2].element.getBoundingClientRect();

      // Move the cursor all the way to the bottom so it doesn't intersect along the y axis.
      dragElementViaMouse(fixture, firstItem.element, thirdItemRect.left + 1, thirdItemRect.bottom + 1000);
      await wait(0);
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      // Assert the event like this, rather than `toHaveBeenCalledWith`, because Jasmine will
      // go into an infinite loop trying to stringify the event, if the test fails.
      expect(event).toEqual({
        previousIndex: 0,
        currentIndex: 0,
        item: firstItem,
        container: fixture.componentInstance.dropInstance,
        previousContainer: fixture.componentInstance.dropInstance,
        isPointerOverContainer: false,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);
    });

    it("should calculate the index if the list is scrolled while dragging", async () => {
      const fixture = createComponent(DraggableInScrollableVerticalDropZone);
      fixture.detectChanges();
      const dragItems = fixture.componentInstance.dragItems;
      const firstItem = dragItems.first;
      const thirdItemRect = dragItems.toArray()[2].element.getBoundingClientRect();
      const list = fixture.componentInstance.dropInstance.element;

      startDraggingViaMouse(fixture, firstItem.element);
      fixture.detectChanges();

      dispatchMouseEvent(document, "mousemove", thirdItemRect.left + 1, thirdItemRect.top + 1);
      fixture.detectChanges();

      list.scrollTop = ITEM_HEIGHT * 10;
      dispatchFakeEvent(list, "scroll");
      fixture.detectChanges();

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      // Assert the event like this, rather than `toHaveBeenCalledWith`, because Jasmine will
      // go into an infinite loop trying to stringify the event, if the test fails.
      expect(event).toEqual({
        previousIndex: 0,
        currentIndex: 12,
        item: firstItem,
        container: fixture.componentInstance.dropInstance,
        previousContainer: fixture.componentInstance.dropInstance,
        isPointerOverContainer: jasmine.any(Boolean),
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });
    });

    it("should calculate the index if the list is scrolled while dragging inside the shadow DOM", async () => {
      // This test is only relevant for Shadow DOM-supporting browsers.
      if (!_supportsShadowDom()) {
        return;
      }

      const fixture = createComponent(DraggableInScrollableVerticalDropZone);
      fixture.componentInstance.encapsulation = "shadow-dom";
      fixture.detectChanges();
      const dragItems = fixture.componentInstance.dragItems;
      const firstItem = dragItems.first;
      const thirdItemRect = dragItems.toArray()[2].element.getBoundingClientRect();
      const list = fixture.componentInstance.dropInstance.element;

      startDraggingViaMouse(fixture, firstItem.element);
      fixture.detectChanges();

      dispatchMouseEvent(document, "mousemove", thirdItemRect.left + 1, thirdItemRect.top + 1);
      fixture.detectChanges();

      list.scrollTop = ITEM_HEIGHT * 10;
      dispatchFakeEvent(list, "scroll");
      fixture.detectChanges();

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      // Assert the event like this, rather than `toHaveBeenCalledWith`, because Jasmine will
      // go into an infinite loop trying to stringify the event, if the test fails.
      expect(event).toEqual({
        previousIndex: 0,
        currentIndex: 12,
        item: firstItem,
        container: fixture.componentInstance.dropInstance,
        previousContainer: fixture.componentInstance.dropInstance,
        isPointerOverContainer: jasmine.any(Boolean),
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });
    });

    it("should calculate the index if the viewport is scrolled while dragging", async () => {
      const fixture = createComponent(DraggableInDropZone);

      for (let i = 0; i < 200; i++) {
        fixture.componentInstance.items.push({
          value: `Extra item ${i}`,
          height: ITEM_HEIGHT,
          margin: 0,
        });
      }

      fixture.componentInstance.markForCheck();
      fixture.detectChanges();
      const dragItems = fixture.componentInstance.dragItems;
      const firstItem = dragItems.first;
      const thirdItemRect = dragItems.toArray()[2].element.getBoundingClientRect();

      startDraggingViaMouse(fixture, firstItem.element);
      fixture.detectChanges();

      dispatchMouseEvent(document, "mousemove", thirdItemRect.left + 1, thirdItemRect.top + 1);
      fixture.detectChanges();

      scrollTo(0, ITEM_HEIGHT * 10);
      dispatchFakeEvent(document, "scroll");
      fixture.detectChanges();

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      // Assert the event like this, rather than `toHaveBeenCalledWith`, because Jasmine will
      // go into an infinite loop trying to stringify the event, if the test fails.
      expect(event).toEqual({
        previousIndex: 0,
        currentIndex: 12,
        item: firstItem,
        container: fixture.componentInstance.dropInstance,
        previousContainer: fixture.componentInstance.dropInstance,
        isPointerOverContainer: jasmine.any(Boolean),
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });

      scrollTo(0, 0);
    });

    it("should remove the anchor node once dragging stops", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const list = fixture.componentInstance.dropInstance.element;

      startDraggingViaMouse(fixture, item);

      const anchor = Array.from(list.childNodes).find((node) => node.textContent === "cdk-drag-marker");
      expect(anchor).toBeTruthy();

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);

      expect(anchor!.parentNode).toBeFalsy();
    });

    it("should create a preview element while the item is dragged", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const itemRect = item.getBoundingClientRect();
      const initialParent = item.parentNode;

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview") as HTMLElement;
      const previewRect = preview.getBoundingClientRect();

      expect(item.parentNode, "Expected element to be moved out into the body").toBe(document.body);
      expect(item.style.position, "Expected element to be removed from layout").toBe("fixed");
      expect(item.style.getPropertyPriority("position"), "Expect element position to be !important").toBe("important");
      // Use a regex here since some browsers normalize 0 to 0px, but others don't.
      expect(item.style.top, "Expected element to be removed from layout").toMatch(/^0(px)?$/);
      expect(item.style.left, "Expected element to be removed from layout").toBe("-999em");
      expect(item.style.opacity, "Expected element to be invisible").toBe("0");
      expect(preview, "Expected preview to be in the DOM").toBeTruthy();
      expect(preview.getAttribute("popover"), "Expected preview to be a popover").toBe("manual");
      expect(preview.style.margin, "Expected preview to reset the margin").toMatch(/^(0(px)? auto 0(px)? 0(px)?)|(0(px)?)$/);
      expect(preview.textContent!.trim(), "Expected preview content to match element").toContain("One");
      expect(preview.getAttribute("dir"), "Expected preview element to inherit the directionality.").toBe("ltr");
      expect(previewRect.width, "Expected preview width to match element").toBe(itemRect.width);
      expect(previewRect.height, "Expected preview height to match element").toBe(itemRect.height);
      expect(preview.style.pointerEvents, "Expected pointer events to be disabled on the preview").toBe("none");
      expect(preview.style.zIndex, "Expected preview to have a high default zIndex.").toBe("1000");
      // Use a regex here since some browsers normalize 0 to 0px, but others don't.
      expect(preview.style.margin, "Expected the preview margin to be reset.").toMatch(/^(0(px)? auto 0(px)? 0(px)?)|(0(px)?)$/);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);

      expect(item.parentNode, "Expected element to be moved back into its old parent").toBe(initialParent);
      expect(item.style.position, "Expected element to be within the layout").toBeFalsy();
      expect(item.style.top, "Expected element to be within the layout").toBeFalsy();
      expect(item.style.left, "Expected element to be within the layout").toBeFalsy();
      expect(item.style.opacity, "Expected element to be visible").toBeFalsy();
      expect(preview.parentNode, "Expected preview to be removed from the DOM").toBeFalsy();
    });

    it("should be able to configure the preview z-index", async () => {
      const fixture = createComponent(DraggableInDropZone, {
        dragConfig: {
          dragStartThreshold: 0,
          zIndex: 3000,
        },
      });
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;
      expect(preview.style.zIndex).toBe("3000");
    });

    it("should be able to constrain the preview position", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.componentInstance.boundarySelector = ".cdk-drop-list";
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const listRect = fixture.componentInstance.dropInstance.element.getBoundingClientRect();

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;

      startDraggingViaMouse(fixture, item, listRect.right + 50, listRect.bottom + 50);
      await wait(0);
      dispatchMouseEvent(document, "mousemove", listRect.right + 50, listRect.bottom + 50);
      fixture.detectChanges();

      const previewRect = preview.getBoundingClientRect();

      expect(Math.floor(previewRect.bottom)).toBe(Math.floor(listRect.bottom));
      expect(Math.floor(previewRect.right)).toBe(Math.floor(listRect.right));
    });

    it("should update the boundary if the page is scrolled while dragging", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.componentInstance.boundarySelector = ".cdk-drop-list";
      fixture.detectChanges();

      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const list = fixture.componentInstance.dropInstance.element;
      const cleanup = makeScrollable();
      scrollTo(0, 10);
      let listRect = list.getBoundingClientRect(); // Note that we need to measure after scrolling.

      startDraggingViaMouse(fixture, item);
      startDraggingViaMouse(fixture, item, listRect.right, listRect.bottom);
      await wait(0);
      dispatchMouseEvent(document, "mousemove", listRect.right, listRect.bottom);
      fixture.detectChanges();

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;
      let previewRect = preview.getBoundingClientRect();
      expect(Math.floor(previewRect.bottom)).toBe(Math.floor(listRect.bottom));

      scrollTo(0, 0);
      dispatchFakeEvent(document, "scroll");
      fixture.detectChanges();
      listRect = list.getBoundingClientRect(); // We need to update these since we've scrolled.
      dispatchMouseEvent(document, "mousemove", listRect.right, listRect.bottom);
      fixture.detectChanges();
      previewRect = preview.getBoundingClientRect();

      expect(Math.floor(previewRect.bottom)).toBe(Math.floor(listRect.bottom));
      cleanup();
    });

    it("should update the boundary if a parent is scrolled while dragging", async () => {
      const fixture = createComponent(DraggableInScrollableParentContainer);
      fixture.componentInstance.boundarySelector = ".cdk-drop-list";
      fixture.detectChanges();

      const container: HTMLElement = fixture.nativeElement.querySelector(".scroll-container")!;
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const list = fixture.componentInstance.dropInstance.element;
      const cleanup = makeScrollable("vertical", container);
      container.scrollTop = 10;
      let listRect = list.getBoundingClientRect(); // Note that we need to measure after scrolling.

      startDraggingViaMouse(fixture, item);
      startDraggingViaMouse(fixture, item, listRect.right, listRect.bottom);
      await wait(0);
      dispatchMouseEvent(document, "mousemove", listRect.right, listRect.bottom);
      fixture.detectChanges();

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;
      let previewRect = preview.getBoundingClientRect();

      // Different browsers round the scroll position differently so
      // assert that the offsets are within a pixel of each other.
      expect(Math.abs(previewRect.bottom - listRect.bottom)).toBeLessThan(2);

      container.scrollTop = 0;
      dispatchFakeEvent(container, "scroll");
      fixture.detectChanges();
      listRect = list.getBoundingClientRect(); // We need to update these since we've scrolled.
      dispatchMouseEvent(document, "mousemove", listRect.right, listRect.bottom);
      fixture.detectChanges();
      previewRect = preview.getBoundingClientRect();

      expect(Math.abs(previewRect.bottom - listRect.bottom)).toBeLessThan(2);
      cleanup();
    });

    it("should update the boundary if a parent is scrolled while dragging inside the shadow DOM", async () => {
      // This test is only relevant for Shadow DOM-supporting browsers.
      if (!_supportsShadowDom()) {
        return;
      }

      const fixture = createComponent(DraggableInScrollableParentContainer);
      fixture.componentInstance.encapsulation = "shadow-dom";
      fixture.componentInstance.boundarySelector = ".cdk-drop-list";
      fixture.detectChanges();

      const container: HTMLElement = fixture.nativeElement.shadowRoot!.querySelector(".scroll-container")!;
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const list = fixture.componentInstance.dropInstance.element;
      const cleanup = makeScrollable("vertical", container);
      container.scrollTop = 10;

      // Note that we need to measure after scrolling.
      let listRect = list.getBoundingClientRect();

      startDraggingViaMouse(fixture, item);
      startDraggingViaMouse(fixture, item, listRect.right, listRect.bottom);
      await wait(0);
      dispatchMouseEvent(document, "mousemove", listRect.right, listRect.bottom);
      fixture.detectChanges();

      const preview = fixture.nativeElement.shadowRoot!.querySelector(".cdk-drag-preview")! as HTMLElement;
      let previewRect = preview.getBoundingClientRect();

      // Different browsers round the scroll position differently so
      // assert that the offsets are within a pixel of each other.
      expect(Math.abs(previewRect.bottom - listRect.bottom)).toBeLessThan(2);

      container.scrollTop = 0;
      dispatchFakeEvent(container, "scroll");
      fixture.detectChanges();
      listRect = list.getBoundingClientRect(); // We need to update these since we've scrolled.
      dispatchMouseEvent(document, "mousemove", listRect.right, listRect.bottom);
      fixture.detectChanges();
      previewRect = preview.getBoundingClientRect();

      expect(Math.abs(previewRect.bottom - listRect.bottom)).toBeLessThan(2);
      cleanup();
    });

    it("should clear the id from the preview", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      item.id = "custom-id";

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;

      expect(preview.getAttribute("id")).toBeFalsy();
    });

    it("should clone the content of descendant canvas elements", async () => {
      const fixture = createComponent(DraggableWithCanvasInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const sourceCanvas = item.querySelector("canvas") as HTMLCanvasElement;

      // via https://stackoverflow.com/a/17386803/2204158
      // via https://stackoverflow.com/a/17386803/2204158
      expect(
        sourceCanvas
          .getContext("2d")!
          .getImageData(0, 0, sourceCanvas.width, sourceCanvas.height)
          .data.some((channel) => channel !== 0),
        "Expected source canvas to have data.",
      ).toBe(true);

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;
      const previewCanvas = preview.querySelector("canvas")!;

      expect(previewCanvas.toDataURL(), "Expected cloned canvas to have the same content as the source.").toBe(sourceCanvas.toDataURL());
    });

    it("should not throw when cloning an invalid canvas", async () => {
      await spyOnGlobalErrorsAsync(async (globalErrorSpy) => {
        const fixture = createComponent(DraggableWithInvalidCanvasInDropZone);
        fixture.detectChanges();
        const item = fixture.componentInstance.dragItems.toArray()[1].element;

        expect(() => startDraggingViaMouse(fixture, item)).not.toThrow();
        await wait(0);

        expect(globalErrorSpy).not.toHaveBeenCalled();
        expect(document.querySelector(".cdk-drag-preview canvas")).toBeTruthy();
      });
    });

    it("should clone the content of descendant input elements", () => {
      const fixture = createComponent(DraggableWithInputsInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const sourceInput = item.querySelector("input")!;
      const sourceTextarea = item.querySelector("textarea")!;
      const sourceSelect = item.querySelector("select")!;
      const value = fixture.componentInstance.inputValue;

      expect(sourceInput.value).toBe(value);
      expect(sourceTextarea.value).toBe(value);
      expect(sourceSelect.value).toBe(value);

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview")!;
      const previewInput = preview.querySelector("input")!;
      const previewTextarea = preview.querySelector("textarea")!;
      const previewSelect = preview.querySelector("select")!;

      expect(previewInput.value).toBe(value);
      expect(previewTextarea.value).toBe(value);
      expect(previewSelect.value).toBe(value);
    });

    it("should preserve checked state for radio inputs in the content", async () => {
      const fixture = createComponent(DraggableWithRadioInputsInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[2].element;
      const sourceRadioInput = item.querySelector<HTMLInputElement>('input[type="radio"]')!;

      expect(sourceRadioInput.checked).toBeTruthy();

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview")!;
      const previewRadioInput = preview.querySelector<HTMLInputElement>('input[type="radio"]')!;
      expect(previewRadioInput.checked, "Expected cloned radio input in preview has the same state as original radio input").toBeTruthy();

      const placeholder = document.querySelector(".cdk-drag-placeholder")!;
      const placeholderRadioInput = placeholder.querySelector<HTMLInputElement>('input[type="radio"]')!;
      expect(placeholderRadioInput.checked, "Expected cloned radio input in placeholder has the same state as original radio input").toBeTruthy();

      dispatchMouseEvent(document, "mouseup");
      // Important to tick with 0 since we don't want to flush any pending timeouts.
      // It also makes sure that all clones have been removed from the DOM.
      await wait(0);

      expect(sourceRadioInput.checked, "Expected original radio input has preserved its original checked state").toBeTruthy();
    });

    it("should clear the ids from descendants of the preview", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const extraChild = document.createElement("div");
      extraChild.id = "child-id";
      extraChild.classList.add("preview-child");
      item.appendChild(extraChild);

      startDraggingViaMouse(fixture, item);

      expect(document.querySelectorAll(".preview-child").length).toBeGreaterThan(1);
      expect(document.querySelectorAll('[id="child-id"]').length).toBe(1);
    });

    it("should not create a preview if the element was not dragged far enough", async () => {
      const fixture = createComponent(DraggableInDropZone, { dragDistance: 5 });
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item);

      expect(document.querySelector(".cdk-drag-preview")).toBeFalsy();
    });

    it("should pass the proper direction to the preview in rtl", async () => {
      const fixture = createComponent(DraggableInDropZone, { dir: "rtl" });

      fixture.detectChanges();

      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      startDraggingViaMouse(fixture, item);

      expect(document.querySelector(".cdk-drag-preview")!.getAttribute("dir"), "Expected preview to inherit the directionality.").toBe("rtl");
    });

    it("should remove the preview if its `transitionend` event timed out", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview") as HTMLElement;

      // Add a duration since the tests won't include one.
      preview.style.transitionDuration = "500ms";

      // Move somewhere so the draggable doesn't exit immediately.
      dispatchMouseEvent(document, "mousemove", 50, 50);
      fixture.detectChanges();

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(250);

      expect(preview.parentNode, "Expected preview to be in the DOM mid-way through the transition").toBeTruthy();

      await wait(500);

      expect(preview.parentNode, "Expected preview to be removed from the DOM if the transition timed out").toBeFalsy();
    });

    it("should be able to set a single class on a preview", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.componentInstance.previewClass = "custom-class";
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;
      expect(preview.classList).toContain("custom-class");
    });

    it("should be able to set multiple classes on a preview", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.componentInstance.previewClass = ["custom-class-1", "custom-class-2"];
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;
      expect(preview.classList).toContain("custom-class-1");
      expect(preview.classList).toContain("custom-class-2");
    });

    it("should emit the released event as soon as the item is released", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1];
      const endedSpy = jasmine.createSpy("ended spy");
      const releasedSpy = jasmine.createSpy("released spy");
      const endedSubscription = item._dragRef.ended.subscribe(endedSpy);
      const releasedSubscription = item._dragRef.released.subscribe(releasedSpy);

      startDraggingViaMouse(fixture, item.element);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;

      // Add a duration since the tests won't include one.
      preview.style.transitionDuration = "500ms";

      // Move somewhere so the draggable doesn't exit immediately.
      dispatchMouseEvent(document, "mousemove", 50, 50);
      fixture.detectChanges();

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();

      // Expected the released event to fire immediately upon release.
      expect(releasedSpy).toHaveBeenCalled();
      await wait(1000);

      // Expected the ended event to fire once the entire sequence is done.
      expect(endedSpy).toHaveBeenCalled();

      endedSubscription.unsubscribe();
      releasedSubscription.unsubscribe();
    });

    it("should reset immediately when failed drag happens after a successful one", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();

      const itemInstance = fixture.componentInstance.dragItems.toArray()[1];
      const item = itemInstance.element;
      const spy = jasmine.createSpy("dropped spy");
      const subscription = itemInstance._dragRef.dropped.subscribe(spy);

      // Do an initial drag and drop sequence.
      dragElementViaMouse(fixture, item, 50, 50);
      await wait(0); // Important to tick with 0 since we don't want to flush any pending timeouts.

      expect(spy).toHaveBeenCalledTimes(1);

      // Start another drag.
      startDraggingViaMouse(fixture, item);

      // Add a duration since the tests won't include one.
      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;
      preview.style.transitionDuration = "500ms";

      // Dispatch the mouseup immediately to simulate the user not moving the element.
      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0); // Important to tick with 0 since we don't want to flush any pending timeouts.

      expect(spy).toHaveBeenCalledTimes(2);

      subscription.unsubscribe();
    });

    it("should not wait for transition that are not on the `transform` property", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;
      preview.style.transition = "opacity 500ms ease";

      dispatchMouseEvent(document, "mousemove", 50, 50);
      fixture.detectChanges();

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);

      expect(preview.parentNode, "Expected preview to be removed from the DOM immediately").toBeFalsy();
    });

    it("should pick out the `transform` duration if multiple properties are being transitioned", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;
      preview.style.transition = "opacity 500ms ease, transform 1000ms ease";

      dispatchMouseEvent(document, "mousemove", 50, 50);
      fixture.detectChanges();

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(500);

      expect(preview.parentNode, "Expected preview to be in the DOM at the end of the opacity transition").toBeTruthy();

      await wait(1000);

      expect(preview.parentNode, "Expected preview to be removed from the DOM at the end of the transform transition").toBeFalsy();
    });

    it("should create a placeholder element while the item is dragged", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const initialParent = item.parentNode;

      startDraggingViaMouse(fixture, item);

      const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;

      expect(placeholder, "Expected placeholder to be in the DOM").toBeTruthy();
      expect(placeholder.parentNode, "Expected placeholder to be inserted into the same parent").toBe(initialParent);
      expect(placeholder.textContent!.trim(), "Expected placeholder content to match element").toContain("One");
      expect(placeholder.style.pointerEvents, "Expected pointer events to be disabled on placeholder").toBe("none");

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);

      expect(placeholder.parentNode, "Expected placeholder to be removed from the DOM").toBeFalsy();
    });

    it("should insert the preview into the `body` if previewContainer is set to `global`", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.componentInstance.previewContainer = "global";
      fixture.componentInstance.markForCheck();
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item);
      const preview = document.querySelector(".cdk-drag-preview") as HTMLElement;
      expect(preview.parentNode).toBe(document.body);
    });

    it("should insert the preview into the parent node if previewContainer is set to `parent`", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.componentInstance.previewContainer = "parent";
      fixture.componentInstance.markForCheck();
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const list = fixture.nativeElement.querySelector(".drop-list");

      startDraggingViaMouse(fixture, item);
      const preview = document.querySelector(".cdk-drag-preview") as HTMLElement;
      expect(list).toBeTruthy();
      expect(preview.parentNode).toBe(list);
    });

    it("should insert the preview into a particular element, if specified", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const previewContainer = fixture.componentInstance.alternatePreviewContainer;

      expect(previewContainer).toBeTruthy();
      fixture.componentInstance.previewContainer = previewContainer;
      fixture.componentInstance.markForCheck();
      fixture.detectChanges();

      startDraggingViaMouse(fixture, item);
      const preview = document.querySelector(".cdk-drag-preview") as HTMLElement;
      expect(preview.parentNode).toBe(previewContainer.nativeElement);
    });

    it("should remove the id from the placeholder", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      item.id = "custom-id";

      startDraggingViaMouse(fixture, item);

      const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;

      expect(placeholder.getAttribute("id")).toBeFalsy();
    });

    it("should clear the ids from descendants of the placeholder", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const extraChild = document.createElement("div");
      extraChild.id = "child-id";
      extraChild.classList.add("placeholder-child");
      item.appendChild(extraChild);

      startDraggingViaMouse(fixture, item);

      expect(document.querySelectorAll(".placeholder-child").length).toBeGreaterThan(1);
      expect(document.querySelectorAll('[id="child-id"]').length).toBe(1);
    });

    it("should not create placeholder if the element was not dragged far enough", () => {
      const fixture = createComponent(DraggableInDropZone, { dragDistance: 5 });
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item);

      expect(document.querySelector(".cdk-drag-placeholder")).toBeFalsy();
    });

    it("should move the placeholder as an item is being sorted down", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      await assertStartToEndSorting(
        "vertical",
        fixture,
        config.getSortedSiblings,
        fixture.componentInstance.dragItems.map((item) => item.element),
      );
    });

    it("should move the placeholder as an item is being sorted down on a scrolled page", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const cleanup = makeScrollable();

      scrollTo(0, 5000);
      await assertStartToEndSorting(
        "vertical",
        fixture,
        config.getSortedSiblings,
        fixture.componentInstance.dragItems.map((item) => item.element),
      );
      cleanup();
    });

    it("should move the placeholder as an item is being sorted up", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      await assertEndToStartSorting(
        "vertical",
        fixture,
        config.getSortedSiblings,
        fixture.componentInstance.dragItems.map((item) => item.element),
      );
    });

    it("should move the placeholder as an item is being sorted up on a scrolled page", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const cleanup = makeScrollable();

      scrollTo(0, 5000);
      await assertEndToStartSorting(
        "vertical",
        fixture,
        config.getSortedSiblings,
        fixture.componentInstance.dragItems.map((item) => item.element),
      );
      cleanup();
    });

    it("should move the placeholder as an item is being sorted to the right", async () => {
      const fixture = createComponent(DraggableInHorizontalDropZone);
      fixture.detectChanges();
      await assertStartToEndSorting(
        "horizontal",
        fixture,
        config.getSortedSiblings,
        fixture.componentInstance.dragItems.map((item) => item.element),
      );
    });

    it("should move the placeholder as an item is being sorted to the left", async () => {
      const fixture = createComponent(DraggableInHorizontalDropZone);
      fixture.detectChanges();
      await assertEndToStartSorting(
        "horizontal",
        fixture,
        config.getSortedSiblings,
        fixture.componentInstance.dragItems.map((item) => item.element),
      );
    });

    it("should lay out the elements correctly, if an element skips multiple positions when sorting vertically", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();

      const items = fixture.componentInstance.dragItems.map((i) => i.element);
      const draggedItem = items[0];
      const { top, left } = draggedItem.getBoundingClientRect();

      startDraggingViaMouse(fixture, draggedItem, left, top);

      const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;
      const targetRect = items[items.length - 1].getBoundingClientRect();

      // Add a few pixels to the top offset so we get some overlap.
      dispatchMouseEvent(document, "mousemove", targetRect.left, targetRect.top + 5);
      fixture.detectChanges();

      expect(config.getSortedSiblings(placeholder, "top").map((e) => e.textContent!.trim())).toEqual(["One", "Two", "Three", "Zero"]);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
    });

    it("should lay out the elements correctly, if an element skips multiple positions when sorting horizontally", async () => {
      const fixture = createComponent(DraggableInHorizontalDropZone);
      fixture.detectChanges();

      const items = fixture.componentInstance.dragItems.map((i) => i.element);
      const draggedItem = items[0];
      const { top, left } = draggedItem.getBoundingClientRect();

      startDraggingViaMouse(fixture, draggedItem, left, top);

      const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;
      const targetRect = items[items.length - 1].getBoundingClientRect();

      // Add a few pixels to the left offset so we get some overlap.
      dispatchMouseEvent(document, "mousemove", targetRect.right - 5, targetRect.top);
      fixture.detectChanges();

      expect(config.getSortedSiblings(placeholder, "left").map((e) => e.textContent!.trim())).toEqual(["One", "Two", "Three", "Zero"]);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
    });

    it("should not swap position for tiny pointer movements", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();

      const items = fixture.componentInstance.dragItems.map((i) => i.element);
      const draggedItem = items[0];
      const target = items[1];
      const { top, left } = draggedItem.getBoundingClientRect();

      // Bump the height so the pointer doesn't leave after swapping.
      target.style.height = `${ITEM_HEIGHT * 3}px`;

      startDraggingViaMouse(fixture, draggedItem, left, top);

      const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;

      expect(config.getSortedSiblings(placeholder, "top").map((e) => e.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);

      const targetRect = target.getBoundingClientRect();
      const pointerTop = targetRect.top + 20;

      // Move over the target so there's a 20px overlap.
      dispatchMouseEvent(document, "mousemove", targetRect.left, pointerTop);
      fixture.detectChanges();
      expect(
        config.getSortedSiblings(placeholder, "top").map((e) => e.textContent!.trim()),
        "Expected position to swap.",
      ).toEqual(["One", "Zero", "Two", "Three"]);

      // Move down a further 1px.
      dispatchMouseEvent(document, "mousemove", targetRect.left, pointerTop + 1);
      fixture.detectChanges();
      expect(
        config.getSortedSiblings(placeholder, "top").map((e) => e.textContent!.trim()),
        "Expected positions not to swap.",
      ).toEqual(["One", "Zero", "Two", "Three"]);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
    });

    it("should swap position for pointer movements in the opposite direction", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();

      const items = fixture.componentInstance.dragItems.map((i) => i.element);
      const draggedItem = items[0];
      const target = items[1];
      const { top, left } = draggedItem.getBoundingClientRect();

      // Bump the height so the pointer doesn't leave after swapping.
      target.style.height = `${ITEM_HEIGHT * 3}px`;

      startDraggingViaMouse(fixture, draggedItem, left, top);

      const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;

      expect(config.getSortedSiblings(placeholder, "top").map((e) => e.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);

      const targetRect = target.getBoundingClientRect();
      const pointerTop = targetRect.top + 20;

      // Move over the target so there's a 20px overlap.
      dispatchMouseEvent(document, "mousemove", targetRect.left, pointerTop);
      fixture.detectChanges();
      expect(
        config.getSortedSiblings(placeholder, "top").map((e) => e.textContent!.trim()),
        "Expected position to swap.",
      ).toEqual(["One", "Zero", "Two", "Three"]);

      // Move up 10px.
      dispatchMouseEvent(document, "mousemove", targetRect.left, pointerTop - 10);
      fixture.detectChanges();
      expect(
        config.getSortedSiblings(placeholder, "top").map((e) => e.textContent!.trim()),
        "Expected positions to swap again.",
      ).toEqual(["Zero", "One", "Two", "Three"]);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
    });

    it("it should allow item swaps in the same drag direction, if the pointer did not overlap with the sibling item after the previous swap", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();

      const items = fixture.componentInstance.dragItems.map((i) => i.element);
      const draggedItem = items[0];
      const target = items[items.length - 1];
      const itemRect = draggedItem.getBoundingClientRect();

      startDraggingViaMouse(fixture, draggedItem, itemRect.left, itemRect.top);

      const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;

      expect(config.getSortedSiblings(placeholder, "top").map((e) => e.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);

      let targetRect = target.getBoundingClientRect();

      // Trigger a mouse move coming from the bottom so that the list thinks that we're
      // sorting upwards. This usually how a user would behave with a mouse pointer.
      dispatchMouseEvent(document, "mousemove", targetRect.left, targetRect.bottom + 50);
      fixture.detectChanges();
      dispatchMouseEvent(document, "mousemove", targetRect.left, targetRect.bottom - 1);
      fixture.detectChanges();

      expect(config.getSortedSiblings(placeholder, "top").map((e) => e.textContent!.trim())).toEqual(["One", "Two", "Three", "Zero"]);

      // Refresh the rect since the element position has changed.
      targetRect = target.getBoundingClientRect();
      dispatchMouseEvent(document, "mousemove", targetRect.left, targetRect.bottom - 1);
      fixture.detectChanges();

      expect(config.getSortedSiblings(placeholder, "top").map((e) => e.textContent!.trim())).toEqual(["One", "Two", "Zero", "Three"]);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
    });

    it("should clean up the preview element if the item is destroyed mid-drag", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview") as HTMLElement;

      expect(preview.parentNode, "Expected preview to be in the DOM").toBeTruthy();
      expect(item.parentNode, "Expected drag item to be in the DOM").toBeTruthy();

      fixture.destroy();

      expect(preview.parentNode, "Expected preview to be removed from the DOM").toBeFalsy();
      expect(item.parentNode, "Expected drag item to be removed from the DOM").toBeFalsy();
    });

    it("should be able to customize the preview element", async () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomPreview);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;

      expect(preview).toBeTruthy();
      expect(preview.classList).toContain("custom-preview");
      expect(preview.textContent!.trim()).toContain("Custom preview");
    });

    it("should handle the custom preview being removed", async () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomPreview);
      fixture.detectChanges();
      await wait(0);
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      fixture.componentInstance.renderCustomPreview = false;
      fixture.componentInstance.markForCheck();
      fixture.detectChanges();
      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;

      expect(preview).toBeTruthy();
      expect(preview.classList).not.toContain("custom-preview");
      expect(preview.textContent!.trim()).not.toContain("Custom preview");
    });

    it("should be able to constrain the position of a custom preview", async () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomPreview);
      fixture.componentInstance.boundarySelector = ".cdk-drop-list";
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const listRect = fixture.componentInstance.dropInstance.element.getBoundingClientRect();

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;

      startDraggingViaMouse(fixture, item, listRect.right + 50, listRect.bottom + 50);
      await wait(0);
      dispatchMouseEvent(document, "mousemove", listRect.right + 50, listRect.bottom + 50);
      fixture.detectChanges();

      const previewRect = preview.getBoundingClientRect();

      expect(Math.floor(previewRect.bottom)).toBe(Math.floor(listRect.bottom));
      expect(Math.floor(previewRect.right)).toBe(Math.floor(listRect.right));
    });

    it("should be able to constrain the preview position with a custom function", async () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomPreview);
      const spy = jasmine.createSpy("constrain position spy").and.returnValue({
        x: 50,
        y: 50,
      } as Point);

      fixture.componentInstance.constrainPosition = spy;
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;

      startDraggingViaMouse(fixture, item, 200, 200);
      await wait(0);
      dispatchMouseEvent(document, "mousemove", 200, 200);
      fixture.detectChanges();

      const previewRect = preview.getBoundingClientRect();

      expect(spy).toHaveBeenCalledWith(
        jasmine.objectContaining({ x: 200, y: 200 }),
        jasmine.any(DragRef),
        jasmine.anything(),
        jasmine.objectContaining({ x: jasmine.any(Number), y: jasmine.any(Number) }),
      );
      expect(Math.floor(previewRect.top)).toBe(50);
      expect(Math.floor(previewRect.left)).toBe(50);
    });

    it("should revert the element back to its parent after dragging with a custom preview has stopped", async () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomPreview);
      fixture.detectChanges();

      const dragContainer = fixture.componentInstance.dropInstance.element;
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      expect(dragContainer.contains(item), "Expected item to be in container.").toBe(true);

      // The coordinates don't matter.
      dragElementViaMouse(fixture, item, 10, 10);
      await wait(0);
      fixture.detectChanges();

      expect(dragContainer.contains(item), "Expected item to be returned to container.").toBe(true);
    });

    it("should position custom previews next to the pointer", async () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomPreview);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item, 50, 50);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;

      expect(preview.style.transform).toBe("translate3d(50px, 50px, 0px)");
    });

    it("should keep the preview next to the trigger if the page was scrolled", async () => {
      const extractTransform = (element: HTMLElement) => {
        const match = element.style.transform.match(/translate3d\(\d+px, (\d+)px, \d+px\)/);
        return match ? parseInt(match[1]) : 0;
      };

      const fixture = createComponent(DraggableInDropZoneWithCustomPreview);
      fixture.detectChanges();
      const platform = getPlatform();

      // The programmatic scrolling inside the Karma iframe doesn't seem to work on iOS in the CI.
      // Skip the test since the logic is the same for all other browsers which are covered.
      if (platform.IOS) {
        return;
      }

      const cleanup = makeScrollable();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item, 50, 50);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;
      expect(extractTransform(preview)).toBe(50);

      scrollTo(0, 5000);
      fixture.detectChanges();

      // Move the pointer a bit so the preview has to reposition.
      dispatchMouseEvent(document, "mousemove", 55, 55);
      fixture.detectChanges();

      // Note that here we just check that the value is greater, because on the
      // CI the values end up being inconsistent between browsers.
      expect(extractTransform(preview)).toBeGreaterThan(1000);

      cleanup();
    });

    it("should lock position inside a drop container along the x axis", async () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomPreview);
      fixture.detectChanges();

      const element = fixture.componentInstance.dragItems.toArray()[1].element;

      fixture.componentInstance.items[1].lockAxis = "x";
      fixture.componentInstance.markForCheck();
      fixture.detectChanges();

      startDraggingViaMouse(fixture, element, 50, 50);

      dispatchMouseEvent(element, "mousemove", 100, 100);
      fixture.detectChanges();

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;

      expect(preview.style.transform).toBe("translate3d(100px, 50px, 0px)");
    });

    it("should lock position inside a drop container along the y axis", async () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomPreview);
      fixture.detectChanges();

      const element = fixture.componentInstance.dragItems.toArray()[1].element;

      fixture.componentInstance.items[1].lockAxis = "y";
      fixture.componentInstance.markForCheck();
      fixture.detectChanges();

      startDraggingViaMouse(fixture, element, 50, 50);

      dispatchMouseEvent(element, "mousemove", 100, 100);
      fixture.detectChanges();

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;

      expect(preview.style.transform).toBe("translate3d(50px, 100px, 0px)");
    });

    it("should inherit the position locking from the drop container", async () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomPreview);
      fixture.detectChanges();

      const element = fixture.componentInstance.dragItems.toArray()[1].element;

      fixture.componentInstance.dropLockAxis.set("x");
      fixture.detectChanges();

      startDraggingViaMouse(fixture, element, 50, 50);

      dispatchMouseEvent(element, "mousemove", 100, 100);
      fixture.detectChanges();

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;

      expect(preview.style.transform).toBe("translate3d(100px, 50px, 0px)");
    });

    it("should be able to set a class on a custom preview", async () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomPreview);
      fixture.componentInstance.previewClass = "custom-class";
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;
      expect(preview.classList).toContain("custom-preview");
      expect(preview.classList).toContain("custom-class");
    });

    it("should be able to apply the size of the dragged element to a custom preview", async () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomPreview);
      fixture.componentInstance.matchPreviewSize = true;
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const itemRect = item.getBoundingClientRect();

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;

      expect(preview).toBeTruthy();
      expect(preview.style.width).toBe(`${itemRect.width}px`);
      expect(preview.style.height).toBe(`${itemRect.height}px`);
    });

    it("should preserve the pickup position if the custom preview inherits the size of the dragged element", async () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomPreview);
      fixture.componentInstance.matchPreviewSize = true;
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item, 50, 50);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;

      expect(preview.style.transform).toBe("translate3d(8px, 33px, 0px)");
    });

    it("should not have the size of the inserted preview affect the size applied via matchSize", async () => {
      const fixture = createComponent(DraggableInHorizontalFlexDropZoneWithMatchSizePreview);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const itemRect = item.getBoundingClientRect();

      startDraggingViaMouse(fixture, item);
      fixture.detectChanges();

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;
      const previewRect = preview.getBoundingClientRect();

      expect(Math.floor(previewRect.width)).toBe(Math.floor(itemRect.width));
      expect(Math.floor(previewRect.height)).toBe(Math.floor(itemRect.height));
    });

    it("should not throw when custom preview only has text", async () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomTextOnlyPreview);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;

      expect(preview).toBeTruthy();
      expect(preview.textContent!.trim()).toContain("Hello One");
    });

    it("should handle custom preview with multiple root nodes", async () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomMultiNodePreview);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item);

      const preview = document.querySelector(".cdk-drag-preview")! as HTMLElement;

      expect(preview).toBeTruthy();
      expect(preview.textContent!.trim()).toContain("HelloOne");
    });

    it("should be able to customize the placeholder", async () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomPlaceholder);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item);

      const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;

      expect(placeholder).toBeTruthy();
      expect(placeholder.classList).toContain("custom-placeholder");
      expect(placeholder.textContent!.trim()).toContain("Custom placeholder");
    });

    it("should handle the custom placeholder being removed", async () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomPlaceholder);
      fixture.detectChanges();
      await wait(0);

      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      fixture.componentInstance.renderPlaceholder = false;
      fixture.componentInstance.markForCheck();
      fixture.detectChanges();

      startDraggingViaMouse(fixture, item);

      const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;

      expect(placeholder).toBeTruthy();
      expect(placeholder.classList).not.toContain("custom-placeholder");
      expect(placeholder.textContent!.trim()).not.toContain("Custom placeholder");
    });

    it("should measure the custom placeholder after the first change detection", async () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomPlaceholder);
      fixture.componentInstance.extraPlaceholderClass = "tall-placeholder";
      fixture.detectChanges();
      const dragItems = fixture.componentInstance.dragItems;
      const item = dragItems.toArray()[0].element;

      startDraggingViaMouse(fixture, item);

      const thirdItem = dragItems.toArray()[2].element;
      const thirdItemRect = thirdItem.getBoundingClientRect();

      dispatchMouseEvent(document, "mousemove", thirdItemRect.left + 1, thirdItemRect.top + 1);
      fixture.detectChanges();

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
      fixture.detectChanges();

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];
      expect(event.currentIndex).toBe(2);
    });

    it("should not throw when custom placeholder only has text", async () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomTextOnlyPlaceholder);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      startDraggingViaMouse(fixture, item);

      const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;

      expect(placeholder).toBeTruthy();
      expect(placeholder.textContent!.trim()).toContain("Hello One");
    });

    it("should handle custom placeholder with multiple root nodes", () => {
      const fixture = createComponent(DraggableInDropZoneWithCustomMultiNodePlaceholder);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      expect(() => {
        startDraggingViaMouse(fixture, item);
      }).not.toThrow();

      const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;

      expect(placeholder).toBeTruthy();
      expect(placeholder.textContent!.trim()).toContain("HelloOne");
    });

    it("should not move the item if the list is disabled", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const dragItems = fixture.componentInstance.dragItems;
      const dropElement = fixture.componentInstance.dropInstance.element;

      expect(dropElement.classList).not.toContain("cdk-drop-list-disabled");

      fixture.componentInstance.dropDisabled.set(true);
      fixture.detectChanges();

      expect(dropElement.classList).toContain("cdk-drop-list-disabled");
      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);

      const firstItem = dragItems.first;
      const thirdItemRect = dragItems.toArray()[2].element.getBoundingClientRect();

      dragElementViaMouse(fixture, firstItem.element, thirdItemRect.right + 1, thirdItemRect.top + 1);
      await wait(0);
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).not.toHaveBeenCalled();

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);
    });

    it("should not throw if the `touches` array is empty", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;

      dispatchTouchEvent(item, "touchstart");
      fixture.detectChanges();

      dispatchTouchEvent(document, "touchmove");
      fixture.detectChanges();

      dispatchTouchEvent(document, "touchmove", 50, 50);
      fixture.detectChanges();

      expect(() => {
        const endEvent = createTouchEvent("touchend", 50, 50);
        Object.defineProperty(endEvent, "touches", { get: () => [] });

        dispatchEvent(document, endEvent);
        fixture.detectChanges();
      }).not.toThrow();
    });

    it("should not move the item if the group is disabled", async () => {
      const fixture = createComponent(ConnectedDropZonesViaGroupDirective);
      fixture.detectChanges();
      const dragItems = fixture.componentInstance.groupedDragItems[0];

      fixture.componentInstance.groupDisabled = true;
      fixture.componentInstance.markForCheck();
      fixture.detectChanges();

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);

      const firstItem = dragItems[0];
      const thirdItemRect = dragItems[2].element.getBoundingClientRect();

      dragElementViaMouse(fixture, firstItem.element, thirdItemRect.right + 1, thirdItemRect.top + 1);
      await wait(0);
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).not.toHaveBeenCalled();

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);
    });

    it("should not sort an item if sorting the list is disabled", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();

      const dropInstance = fixture.componentInstance.dropInstance;
      const dragItems = fixture.componentInstance.dragItems;

      dropInstance.sortingDisabled = true;

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);

      const firstItem = dragItems.first;
      const thirdItemRect = dragItems.toArray()[2].element.getBoundingClientRect();
      const targetX = thirdItemRect.left + 1;
      const targetY = thirdItemRect.top + 1;

      startDraggingViaMouse(fixture, firstItem.element);

      const placeholder = document.querySelector(".cdk-drag-placeholder") as HTMLElement;

      dispatchMouseEvent(document, "mousemove", targetX, targetY);
      fixture.detectChanges();

      expect(config.getSortedSiblings(placeholder, "top").indexOf(placeholder), "Expected placeholder to stay in place.").toBe(0);

      dispatchMouseEvent(document, "mouseup", targetX, targetY);
      fixture.detectChanges();

      await wait(0);
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      // Assert the event like this, rather than `toHaveBeenCalledWith`, because Jasmine will
      // go into an infinite loop trying to stringify the event, if the test fails.
      expect(event).toEqual({
        previousIndex: 0,
        currentIndex: 0,
        item: firstItem,
        container: dropInstance,
        previousContainer: dropInstance,
        isPointerOverContainer: true,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);
    });

    it("should not throw if an item is removed after dragging has started", async () => {
      await spyOnGlobalErrorsAsync(async (globalErrorSpy) => {
        const fixture = createComponent(DraggableInDropZone);
        fixture.detectChanges();
        const dragItems = fixture.componentInstance.dragItems;
        const firstElement = dragItems.first.element;
        const lastItemRect = dragItems.last.element.getBoundingClientRect();

        // Start dragging.
        startDraggingViaMouse(fixture, firstElement);

        // Remove the last item.
        fixture.componentInstance.items.pop();
        fixture.componentInstance.markForCheck();
        fixture.detectChanges();

        expect(() => {
          // Move the dragged item over where the remove item would've been.
          dispatchMouseEvent(document, "mousemove", lastItemRect.left + 1, lastItemRect.top + 1);
          fixture.detectChanges();
        }).not.toThrow();
        await wait(0);

        expect(globalErrorSpy).not.toHaveBeenCalled();
      });
    });

    it("should not be able to start a drag sequence while another one is still active", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const [item, otherItem] = fixture.componentInstance.dragItems.toArray();

      startDraggingViaMouse(fixture, item.element);

      expect(document.querySelectorAll(".cdk-drag-dragging").length, "Expected one item to be dragged initially.").toBe(1);

      startDraggingViaMouse(fixture, otherItem.element);

      expect(document.querySelectorAll(".cdk-drag-dragging").length, "Expected only one item to continue to be dragged.").toBe(1);
    });

    it("should should be able to disable auto-scrolling", async () => {
      const fixture = createComponent(DraggableInScrollableVerticalDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.first.element;
      const list = fixture.componentInstance.dropInstance.element;
      const listRect = list.getBoundingClientRect();

      fixture.componentInstance.dropInstance.autoScrollDisabled = true;
      fixture.detectChanges();

      expect(list.scrollTop).toBe(0);

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", listRect.left + listRect.width / 2, listRect.top + listRect.height);
      fixture.detectChanges();
      await wait(100);

      expect(list.scrollTop).toBe(0);
    });

    it("should auto-scroll down if the user holds their pointer at bottom edge", async () => {
      const fixture = createComponent(DraggableInScrollableVerticalDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.first.element;
      const list = fixture.componentInstance.dropInstance.element;
      const listRect = list.getBoundingClientRect();

      expect(list.scrollTop).toBe(0);

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", listRect.left + listRect.width / 2, listRect.top + listRect.height);
      fixture.detectChanges();
      await wait(100);

      expect(list.scrollTop).toBeGreaterThan(0);
    });

    it("should auto-scroll up if the user holds their pointer at top edge", async () => {
      const fixture = createComponent(DraggableInScrollableVerticalDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.first.element;
      const list = fixture.componentInstance.dropInstance.element;
      const listRect = list.getBoundingClientRect();
      const initialScrollDistance = (list.scrollTop = list.scrollHeight);

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", listRect.left + listRect.width / 2, listRect.top);
      fixture.detectChanges();
      await wait(100);

      expect(list.scrollTop).toBeLessThan(initialScrollDistance);
    });

    it("should auto-scroll right if the user holds their pointer at right edge in ltr", async () => {
      const fixture = createComponent(DraggableInScrollableHorizontalDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.first.element;
      const list = fixture.componentInstance.dropInstance.element;
      const listRect = list.getBoundingClientRect();

      expect(list.scrollLeft).toBe(0);

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", listRect.left + listRect.width, listRect.top + listRect.height / 2);
      fixture.detectChanges();
      await wait(100);

      expect(list.scrollLeft).toBeGreaterThan(0);
    });

    it("should auto-scroll left if the user holds their pointer at left edge in ltr", async () => {
      const fixture = createComponent(DraggableInScrollableHorizontalDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.first.element;
      const list = fixture.componentInstance.dropInstance.element;
      const listRect = list.getBoundingClientRect();
      const initialScrollDistance = (list.scrollLeft = list.scrollWidth);

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", listRect.left, listRect.top + listRect.height / 2);
      fixture.detectChanges();
      await wait(100);

      expect(list.scrollLeft).toBeLessThan(initialScrollDistance);
    });

    it("should auto-scroll right if the user holds their pointer at right edge in rtl", async () => {
      const fixture = createComponent(DraggableInScrollableHorizontalDropZone, { dir: "rtl" });
      fixture.nativeElement.setAttribute("dir", "rtl");
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.first.element;
      const list = fixture.componentInstance.dropInstance.element;
      const listRect = list.getBoundingClientRect();
      const initialScrollDistance = (list.scrollLeft = -list.scrollWidth);

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", listRect.left + listRect.width, listRect.top + listRect.height / 2);
      fixture.detectChanges();
      await wait(100);

      expect(list.scrollLeft).toBeGreaterThan(initialScrollDistance);
    });

    it("should auto-scroll left if the user holds their pointer at left edge in rtl", async () => {
      const fixture = createComponent(DraggableInScrollableHorizontalDropZone, { dir: "rtl" });
      fixture.nativeElement.setAttribute("dir", "rtl");
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.first.element;
      const list = fixture.componentInstance.dropInstance.element;
      const listRect = list.getBoundingClientRect();

      expect(list.scrollLeft).toBe(0);

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", listRect.left, listRect.top + listRect.height / 2);
      fixture.detectChanges();
      await wait(100);

      expect(list.scrollLeft).toBeLessThan(0);
    });

    it("should be able to start auto scrolling with a drag boundary", async () => {
      const fixture = createComponent(DraggableInScrollableHorizontalDropZone);
      fixture.componentInstance.boundarySelector = ".drop-list";
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.first.element;
      const list = fixture.componentInstance.dropInstance.element;
      const listRect = list.getBoundingClientRect();

      expect(list.scrollLeft).toBe(0);

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", listRect.left + listRect.width, listRect.top + listRect.height / 2);
      fixture.detectChanges();
      await wait(100);

      expect(list.scrollLeft).toBeGreaterThan(0);
    });

    it("should stop scrolling if the user moves their pointer away", async () => {
      const fixture = createComponent(DraggableInScrollableVerticalDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.first.element;
      const list = fixture.componentInstance.dropInstance.element;
      const listRect = list.getBoundingClientRect();

      expect(list.scrollTop).toBe(0);

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", listRect.left + listRect.width / 2, listRect.top + listRect.height);
      fixture.detectChanges();
      await wait(100);

      const previousScrollTop = list.scrollTop;
      expect(previousScrollTop).toBeGreaterThan(0);

      // Move the pointer away from the edge of the element.
      dispatchMouseEvent(document, "mousemove", listRect.left + listRect.width / 2, listRect.bottom + listRect.height / 2);
      fixture.detectChanges();
      await wait(100);

      expect(list.scrollTop).toBe(previousScrollTop);
    });

    it("should stop scrolling if the user stops dragging", async () => {
      const fixture = createComponent(DraggableInScrollableVerticalDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.first.element;
      const list = fixture.componentInstance.dropInstance.element;
      const listRect = list.getBoundingClientRect();

      expect(list.scrollTop).toBe(0);

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", listRect.left + listRect.width / 2, listRect.top + listRect.height);
      fixture.detectChanges();
      await wait(100);

      const previousScrollTop = list.scrollTop;
      expect(previousScrollTop).toBeGreaterThan(0);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(100);
      await wait(0);
      fixture.detectChanges();

      expect(list.scrollTop).toBe(previousScrollTop);
    });

    it("should auto-scroll viewport down if the pointer is close to bottom edge", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();

      const cleanup = makeScrollable();
      const item = fixture.componentInstance.dragItems.first.element;
      const viewportRuler = getViewportRuler();
      const viewportSize = viewportRuler.getViewportSize();

      expect(viewportRuler.getViewportScrollPosition().top).toBe(0);

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", viewportSize.width / 2, viewportSize.height);
      fixture.detectChanges();
      await wait(100);

      expect(viewportRuler.getViewportScrollPosition().top).toBeGreaterThan(0);

      cleanup();
    });

    it("should auto-scroll viewport up if the pointer is close to top edge", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();

      const cleanup = makeScrollable();
      const item = fixture.componentInstance.dragItems.first.element;
      const viewportRuler = getViewportRuler();
      const viewportSize = viewportRuler.getViewportSize();

      scrollTo(0, viewportSize.height * 5);
      const initialScrollDistance = viewportRuler.getViewportScrollPosition().top;
      expect(initialScrollDistance).toBeGreaterThan(0);

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", viewportSize.width / 2, 0);
      fixture.detectChanges();
      await wait(100);

      expect(viewportRuler.getViewportScrollPosition().top).toBeLessThan(initialScrollDistance);

      cleanup();
    });

    it("should auto-scroll viewport right if the pointer is near right edge", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();

      const cleanup = makeScrollable("horizontal");
      const item = fixture.componentInstance.dragItems.first.element;
      const viewportRuler = getViewportRuler();
      const viewportSize = viewportRuler.getViewportSize();

      expect(viewportRuler.getViewportScrollPosition().left).toBe(0);

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", viewportSize.width, viewportSize.height / 2);
      fixture.detectChanges();
      await wait(100);

      expect(viewportRuler.getViewportScrollPosition().left).toBeGreaterThan(0);

      cleanup();
    });

    it("should auto-scroll viewport left if the pointer is close to left edge", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();

      const cleanup = makeScrollable("horizontal");
      const item = fixture.componentInstance.dragItems.first.element;
      const viewportRuler = getViewportRuler();
      const viewportSize = viewportRuler.getViewportSize();

      scrollTo(viewportSize.width * 5, 0);
      const initialScrollDistance = viewportRuler.getViewportScrollPosition().left;
      expect(initialScrollDistance).toBeGreaterThan(0);

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", 0, viewportSize.height / 2);
      fixture.detectChanges();
      await wait(100);

      expect(viewportRuler.getViewportScrollPosition().left).toBeLessThan(initialScrollDistance);

      cleanup();
    });

    it("should auto-scroll the list, not the viewport, when the pointer is over the edge of both the list and the viewport", async () => {
      const fixture = createComponent(DraggableInScrollableVerticalDropZone);
      fixture.detectChanges();

      const list = fixture.componentInstance.dropInstance.element;
      const viewportRuler = getViewportRuler();
      const item = fixture.componentInstance.dragItems.first.element;

      // Position the list so that its top aligns with the viewport top. That way the pointer
      // will both over its top edge and the viewport's. We use top instead of bottom, because
      // bottom behaves weirdly when we run tests on mobile devices.
      list.style.position = "fixed";
      list.style.left = "50%";
      list.style.top = "0";
      list.style.margin = "0";

      const listRect = list.getBoundingClientRect();
      const cleanup = makeScrollable();

      scrollTo(0, viewportRuler.getViewportSize().height * 5);
      list.scrollTop = 50;

      const initialScrollDistance = viewportRuler.getViewportScrollPosition().top;
      expect(initialScrollDistance).toBeGreaterThan(0);
      expect(list.scrollTop).toBe(50);

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", listRect.left + listRect.width / 2, 0);
      fixture.detectChanges();
      await wait(100);

      expect(viewportRuler.getViewportScrollPosition().top).toBe(initialScrollDistance);
      expect(list.scrollTop).toBeLessThan(50);

      cleanup();
    });

    it("should auto-scroll the viewport, when the pointer is over the edge of both the list and the viewport, if the list cannot be scrolled in that direction", async () => {
      const fixture = createComponent(DraggableInScrollableVerticalDropZone);
      fixture.detectChanges();

      const list = fixture.componentInstance.dropInstance.element;
      const viewportRuler = getViewportRuler();
      const item = fixture.componentInstance.dragItems.first.element;

      // Position the list so that its top aligns with the viewport top. That way the pointer
      // will both over its top edge and the viewport's. We use top instead of bottom, because
      // bottom behaves weirdly when we run tests on mobile devices.
      list.style.position = "fixed";
      list.style.left = "50%";
      list.style.top = "0";
      list.style.margin = "0";

      const listRect = list.getBoundingClientRect();
      const cleanup = makeScrollable();

      scrollTo(0, viewportRuler.getViewportSize().height * 5);
      list.scrollTop = 0;

      const initialScrollDistance = viewportRuler.getViewportScrollPosition().top;
      expect(initialScrollDistance).toBeGreaterThan(0);
      expect(list.scrollTop).toBe(0);

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", listRect.left + listRect.width / 2, 0);
      fixture.detectChanges();
      await wait(100);

      expect(viewportRuler.getViewportScrollPosition().top).toBeLessThan(initialScrollDistance);
      expect(list.scrollTop).toBe(0);

      cleanup();
    });

    it("should be able to auto-scroll a parent container", async () => {
      const fixture = createComponent(DraggableInScrollableParentContainer);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.first.element;
      const container = fixture.nativeElement.querySelector<HTMLElement>(".scroll-container")!;
      const containerRect = container.getBoundingClientRect();

      expect(container.scrollTop).toBe(0);

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", containerRect.left + containerRect.width / 2, containerRect.top + containerRect.height);
      fixture.detectChanges();
      await wait(100);

      expect(container.scrollTop).toBeGreaterThan(0);
    });

    it("should be able to configure the auto-scroll speed", async () => {
      const fixture = createComponent(DraggableInScrollableVerticalDropZone);
      fixture.detectChanges();
      fixture.componentInstance.dropInstance.autoScrollStep = 20;
      const item = fixture.componentInstance.dragItems.first.element;
      const list = fixture.componentInstance.dropInstance.element;
      const listRect = list.getBoundingClientRect();

      expect(list.scrollTop).toBe(0);

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", listRect.left + listRect.width / 2, listRect.top + listRect.height);
      fixture.detectChanges();
      await wait(100);

      expect(list.scrollTop).toBeGreaterThan(100);
    });

    it("should pick up descendants inside of containers", async () => {
      const fixture = createComponent(DraggableInDropZoneWithContainer);
      fixture.detectChanges();
      const dragItems = fixture.componentInstance.dragItems;
      const firstItem = dragItems.first;
      const thirdItemRect = dragItems.toArray()[2].element.getBoundingClientRect();

      dragElementViaMouse(fixture, firstItem.element, thirdItemRect.left + 1, thirdItemRect.top + 1);
      await wait(0);
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      // Assert the event like this, rather than `toHaveBeenCalledWith`, because Jasmine will
      // go into an infinite loop trying to stringify the event, if the test fails.
      expect(event).toEqual({
        previousIndex: 0,
        currentIndex: 2,
        item: firstItem,
        container: fixture.componentInstance.dropInstance,
        previousContainer: fixture.componentInstance.dropInstance,
        isPointerOverContainer: true,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });
    });

    it("should not pick up items from descendant drop lists", async () => {
      const fixture = createComponent(NestedDropZones);
      fixture.detectChanges();
      const { dragItems, innerList, outerList } = fixture.componentInstance;
      const innerClasses = innerList.nativeElement.classList;
      const outerClasses = outerList.nativeElement.classList;
      const draggingClass = "cdk-drop-list-dragging";

      expect(innerClasses, "Expected inner list to start off as not dragging.").not.toContain(draggingClass);
      expect(outerClasses, "Expected outer list to start off as not dragging.").not.toContain(draggingClass);

      startDraggingViaMouse(fixture, dragItems.first.element);
      fixture.detectChanges();

      expect(innerClasses, "Expected inner list to be dragging.").toContain(draggingClass);
      expect(outerClasses, "Expected outer list to not be dragging.").not.toContain(draggingClass);
    });

    it("should be able to re-enable a disabled drop list", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const dragItems = fixture.componentInstance.dragItems;
      const tryDrag = async () => {
        const firstItem = dragItems.first;
        const thirdItemRect = dragItems.toArray()[2].element.getBoundingClientRect();
        dragElementViaMouse(fixture, firstItem.element, thirdItemRect.left + 1, thirdItemRect.top + 1);
        await wait(0);
        fixture.detectChanges();
      };

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);

      fixture.componentInstance.dropDisabled.set(true);
      fixture.detectChanges();
      await tryDrag();

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);

      fixture.componentInstance.dropDisabled.set(false);
      fixture.detectChanges();
      await tryDrag();

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["One", "Two", "Zero", "Three"]);
    });

    it("should be able to configure the drop input defaults through a provider", async () => {
      const config: DragDropConfig = {
        draggingDisabled: true,
        sortingDisabled: true,
        listAutoScrollDisabled: true,
        listOrientation: "horizontal",
        lockAxis: "y",
      };

      const fixture = createComponent(PlainStandaloneDropList, { dragConfig: config });
      fixture.detectChanges();
      const list = fixture.componentInstance.dropList;
      expect(list.disabled).toBe(true);
      expect(list.sortingDisabled).toBe(true);
      expect(list.autoScrollDisabled).toBe(true);
      expect(list.orientation).toBe("horizontal");
      expect(list.lockAxis).toBe("y");
    });

    it("should disable scroll snapping while the user is dragging", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const styles: any = fixture.componentInstance.dropInstance.element.style;

      // This test only applies to browsers that support scroll snapping.
      if (!("scrollSnapType" in styles) && !("msScrollSnapType" in styles)) {
        return;
      }

      expect(styles.scrollSnapType || styles.msScrollSnapType).toBeFalsy();

      startDraggingViaMouse(fixture, item);

      expect(styles.scrollSnapType || styles.msScrollSnapType).toBe("none");

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
      fixture.detectChanges();

      expect(styles.scrollSnapType || styles.msScrollSnapType).toBeFalsy();
    });

    it("should restore the previous inline scroll snap value", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      const styles: any = fixture.componentInstance.dropInstance.element.style;

      // This test only applies to browsers that support scroll snapping.
      if (!("scrollSnapType" in styles) && !("msScrollSnapType" in styles)) {
        return;
      }

      styles.scrollSnapType = styles.msScrollSnapType = "block";
      expect(styles.scrollSnapType || styles.msScrollSnapType).toBe("block");

      startDraggingViaMouse(fixture, item);

      expect(styles.scrollSnapType || styles.msScrollSnapType).toBe("none");

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);
      fixture.detectChanges();

      expect(styles.scrollSnapType || styles.msScrollSnapType).toBe("block");
    });

    it("should be able to start dragging again if the dragged item is destroyed", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();

      let item = fixture.componentInstance.dragItems.first;
      startDraggingViaMouse(fixture, item.element);
      expect(document.querySelector(".cdk-drop-list-dragging"), "Expected to drag initially.").toBeTruthy();

      fixture.componentInstance.items = [
        { value: "Five", height: ITEM_HEIGHT, margin: 0 },
        { value: "Six", height: ITEM_HEIGHT, margin: 0 },
      ];
      fixture.componentInstance.markForCheck();
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).not.toHaveBeenCalled();
      expect(document.querySelector(".cdk-drop-list-dragging"), "Expected not to be dragging after item is destroyed.").toBeFalsy();

      item = fixture.componentInstance.dragItems.first;
      startDraggingViaMouse(fixture, item.element);

      expect(document.querySelector(".cdk-drop-list-dragging"), "Expected to be able to start a new drag sequence.").toBeTruthy();

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);
    });

    it("should make the placeholder available in the start event", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const item = fixture.componentInstance.dragItems.toArray()[1].element;
      let placeholder: HTMLElement | undefined;

      fixture.componentInstance.startedSpy.and.callFake((event: DragStart) => {
        placeholder = event.source.getPlaceholderElement();
      });

      startDraggingViaMouse(fixture, item);
      expect(placeholder).toBeTruthy();
    });

    it("should not move item into position not allowed by the sort predicate", async () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const dragItems = fixture.componentInstance.dragItems;
      const spy = jasmine.createSpy("sort predicate spy").and.returnValue(false);
      fixture.componentInstance.dropInstance.sortPredicate = spy;

      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);

      const firstItem = dragItems.first;
      const thirdItemRect = dragItems.toArray()[2].element.getBoundingClientRect();

      startDraggingViaMouse(fixture, firstItem.element);
      dispatchMouseEvent(document, "mousemove", thirdItemRect.left + 1, thirdItemRect.top + 1);
      fixture.detectChanges();

      expect(spy).toHaveBeenCalledWith(2, firstItem, fixture.componentInstance.dropInstance);
      expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three"]);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await wait(0);

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      // Assert the event like this, rather than `toHaveBeenCalledWith`, because Jasmine will
      // go into an infinite loop trying to stringify the event, if the test fails.
      expect(event).toEqual({
        previousIndex: 0,
        currentIndex: 0,
        item: firstItem,
        container: fixture.componentInstance.dropInstance,
        previousContainer: fixture.componentInstance.dropInstance,
        isPointerOverContainer: jasmine.any(Boolean),
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });
    });

    it("should not call the sort predicate for the same index", () => {
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();
      const spy = jasmine.createSpy("sort predicate spy").and.returnValue(true);
      fixture.componentInstance.dropInstance.sortPredicate = spy;

      const item = fixture.componentInstance.dragItems.first.element;
      const itemRect = item.getBoundingClientRect();

      startDraggingViaMouse(fixture, item);
      dispatchMouseEvent(document, "mousemove", itemRect.left + 10, itemRect.top + 10);
      fixture.detectChanges();

      expect(spy).not.toHaveBeenCalled();
    });

    it("should throw if drop list is attached to an ng-container", () => {
      expect(() => {
        createComponent(DropListOnNgContainer).detectChanges();
      }).toThrowError(/^cdkDropList must be attached to an element node/);
    });

    it("should sort correctly if the <html> node has been offset", async () => {
      const documentElement = document.documentElement!;
      const fixture = createComponent(DraggableInDropZone);
      fixture.detectChanges();

      documentElement.style.position = "absolute";
      documentElement.style.top = "100px";

      await assertStartToEndSorting(
        "vertical",
        fixture,
        config.getSortedSiblings,
        fixture.componentInstance.dragItems.map((item) => item.element),
      );

      documentElement.style.position = "";
      documentElement.style.top = "";
    });
  });
}
