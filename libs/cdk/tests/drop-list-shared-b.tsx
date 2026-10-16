// Ported from Angular Components (src/cdk/drag-drop/directives/drop-list-shared.spec.ts), MIT, © Google LLC.
// Part B of `defineCommonDropListTests`: "in a connected drop container", "with nested drags", "with an
// alternate element container", "with an anchor" (part A: drop-list-shared-a.tsx).
// Changes:
// - fixtures from drop-list-fixtures.tsx (same names); `@ViewChildren` → getters; `todo = [...]` → signal `set`;
// - `.withContext(m)` → `expect(value, m)`; Jasmine's `toContain(x, message)` → `expect(value, message).toContain(x)`;
// - `fixture.whenStable()` → `whenStable()` (a macrotask: the drop animation of a 0ms transition settles in a microtask);
// - `createComponent(X, { encapsulation: ViewEncapsulation.ShadowDom })` → `createComponent(X, { encapsulation: "shadow-dom" })`
//   (sets `DropListFixture.encapsulation`: the view renders into an open shadow root of the host);
// - directive instances expose `.element` as the element (`item.element.nativeElement` → `item.element`);
// - `jasmine.spyOnGlobalErrorsAsync` → `spyOnGlobalErrorsAsync` (local: window `error` listener).
import { afterEach, describe, expect, it, jasmine, spyOn, type Spy } from "@rivetjs/testing/jasmine";
import { createMouseEvent, dispatchEvent, dispatchFakeEvent, dispatchMouseEvent } from "@rivetjs/testing/fake-events";
import { extendStyles } from "../drag-drop/dom/styling.ts";
import type { DragEnter } from "../drag-drop/index.tsx";
import {
  createComponent as _createComponent,
  continueDraggingViaTouch,
  destroyFixtures,
  dragElementViaMouse,
  makeScrollable,
  startDraggingViaMouse,
  startDraggingViaTouch,
  stopDraggingViaTouch,
  wait,
  type ComponentFixture,
  type DragDropTestConfig,
} from "./drag-test-utils.tsx";
import {
  ConnectedDropListsInOnPush,
  ConnectedDropZones,
  ConnectedDropZonesInsideShadowRootWithNgIf,
  ConnectedDropZonesViaGroupDirective,
  ConnectedDropZonesWithAlternateContainer,
  ConnectedDropZonesWithIntermediateSibling,
  ConnectedDropZonesWithSingleItems,
  ConnectedWrappedDropZones,
  DraggableWithInvalidAlternateContainer,
  DraggableWithMissingAlternateContainer,
  NestedDragsComponent,
  NestedDragsThroughTemplate,
  NestedDropListGroups,
  assertStartToEndSorting,
  type DropListFixture,
  getHorizontalFixtures,
} from "./drop-list-fixtures.tsx";
import type { CommonDropListTestsConfig } from "./drop-list-shared.tsx";

/** Angular `ComponentFixture.whenStable()`: lets the drop sequence (microtasks) settle. */
const whenStable = () => wait(0);

/** Test config + Angular `encapsulation` (`ViewEncapsulation.ShadowDom` → `"shadow-dom"`, see `DropListFixture`). */
interface SharedTestConfig extends DragDropTestConfig {
  encapsulation?: DropListFixture["encapsulation"];
}

/** Jasmine `spyOnGlobalErrorsAsync`: errors thrown by event listeners reach `window.onerror`. */
async function spyOnGlobalErrorsAsync(fn: (globalErrorSpy: Spy) => Promise<void>) {
  const spy = jasmine.createSpy("global error spy");
  const listener = (event: ErrorEvent) => {
    event.preventDefault();
    spy(event.error);
  };
  window.addEventListener("error", listener);
  try {
    await fn(spy);
  } finally {
    window.removeEventListener("error", listener);
  }
}

export function defineCommonDropListTestsB(config: CommonDropListTestsConfig) {
  // Upstream destructures these at the top of `defineCommonDropListTests` (used by part A).
  const { DraggableInHorizontalDropZone, DraggableInScrollableHorizontalDropZone, DraggableInHorizontalFlexDropZoneWithMatchSizePreview } =
    getHorizontalFixtures(config.horizontalListOrientation);
  void [DraggableInHorizontalDropZone, DraggableInScrollableHorizontalDropZone, DraggableInHorizontalFlexDropZoneWithMatchSizePreview];

  function createComponent<T extends DropListFixture>(
    type: new () => T,
    testConfig: SharedTestConfig = {},
  ): ComponentFixture<T> & { whenStable(): Promise<unknown> } {
    const { encapsulation, ...rest } = testConfig;
    const fixture = _createComponent(type, { ...rest, listOrientation: config.verticalListOrientation });
    if (encapsulation) fixture.componentInstance.encapsulation = encapsulation;
    return Object.assign(fixture, { whenStable });
  }

  afterEach(() => destroyFixtures());

  describe("in a connected drop container", () => {
    it("should dispatch the `dropped` event when an item has been dropped into a new container", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const item = groups[0][1];
      const targetRect = groups[1][2].element.getBoundingClientRect();

      dragElementViaMouse(fixture, item.element, targetRect.left + 1, targetRect.top + 1);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      expect(event).toEqual({
        previousIndex: 1,
        currentIndex: 3,
        item,
        container: fixture.componentInstance.dropInstances.toArray()[1],
        previousContainer: fixture.componentInstance.dropInstances.first,
        isPointerOverContainer: true,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });
    });

    it("should be able to move the element over a new container and return it", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const dropZones = fixture.componentInstance.dropInstances.map((d) => d.element);
      const item = groups[0][1];
      const initialRect = item.element.getBoundingClientRect();
      const targetRect = groups[1][2].element.getBoundingClientRect();

      startDraggingViaMouse(fixture, item.element);

      const placeholder = dropZones[0].querySelector(".cdk-drag-placeholder")!;

      expect(placeholder).toBeTruthy();
      expect(dropZones[0].contains(placeholder), "Expected placeholder to be inside the first container.").toBe(true);

      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.top + 1);
      fixture.detectChanges();

      expect(dropZones[1].contains(placeholder), "Expected placeholder to be inside second container.").toBe(true);

      dispatchMouseEvent(document, "mousemove", initialRect.left + 1, initialRect.top + 1);
      fixture.detectChanges();

      expect(dropZones[0].contains(placeholder), "Expected placeholder to be back inside first container.").toBe(true);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).not.toHaveBeenCalled();
    });

    it("should be able to move the element over a new container and return it to the initial one, even if it no longer matches the enterPredicate", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const dropZones = fixture.componentInstance.dropInstances.map((d) => d.element);
      const item = groups[0][1];
      const initialRect = item.element.getBoundingClientRect();
      const targetRect = groups[1][2].element.getBoundingClientRect();

      fixture.componentInstance.dropInstances.first.enterPredicate = () => false;
      fixture.detectChanges();

      startDraggingViaMouse(fixture, item.element);

      const placeholder = dropZones[0].querySelector(".cdk-drag-placeholder")!;

      expect(placeholder).toBeTruthy();
      expect(dropZones[0].contains(placeholder), "Expected placeholder to be inside the first container.").toBe(true);

      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.top + 1);
      fixture.detectChanges();

      expect(dropZones[1].contains(placeholder), "Expected placeholder to be inside second container.").toBe(true);

      dispatchMouseEvent(document, "mousemove", initialRect.left + 1, initialRect.top + 1);
      fixture.detectChanges();

      expect(dropZones[0].contains(placeholder), "Expected placeholder to be back inside first container.").toBe(true);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).not.toHaveBeenCalled();
    });

    it("should transfer the DOM element from one drop zone to another", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems.slice();
      const element = groups[0][1].element;
      const dropInstances = fixture.componentInstance.dropInstances.toArray();
      const targetRect = groups[1][1].element.getBoundingClientRect();

      // Use coordinates of [1] item corresponding to [2] item
      // after dragged item is removed from first container
      dragElementViaMouse(fixture, element, targetRect.left + 1, targetRect.top);
      await fixture.whenStable();
      fixture.detectChanges();

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      expect(event).toBeTruthy();
      expect(event).toEqual({
        previousIndex: 1,
        currentIndex: 2, // dragged item should replace the [2] item (see comment above)
        item: groups[0][1],
        container: dropInstances[1],
        previousContainer: dropInstances[0],
        isPointerOverContainer: true,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });
    });

    it("should not be able to transfer an item into a container that is not in `connectedTo`", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.componentInstance.todoConnectedTo.set([]);
      fixture.componentInstance.doneConnectedTo.set([]);
      fixture.componentInstance.extraConnectedTo.set([]);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems.slice();
      const element = groups[0][1].element;
      const dropInstances = fixture.componentInstance.dropInstances.toArray();
      const targetRect = groups[1][2].element.getBoundingClientRect();

      dragElementViaMouse(fixture, element, targetRect.left + 1, targetRect.top + 1);
      await fixture.whenStable();
      fixture.detectChanges();

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      expect(event).toBeTruthy();
      expect(event).toEqual({
        previousIndex: 1,
        currentIndex: 1,
        item: groups[0][1],
        container: dropInstances[0],
        previousContainer: dropInstances[0],
        isPointerOverContainer: false,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });
    });

    it("should not be able to transfer an item that does not match the `enterPredicate`", async () => {
      const fixture = createComponent(ConnectedDropZones);

      fixture.detectChanges();
      fixture.componentInstance.dropInstances.forEach((d) => (d.enterPredicate = () => false));
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems.slice();
      const element = groups[0][1].element;
      const dropInstances = fixture.componentInstance.dropInstances.toArray();
      const targetRect = groups[1][2].element.getBoundingClientRect();

      dragElementViaMouse(fixture, element, targetRect.left + 1, targetRect.top + 1);
      await fixture.whenStable();
      fixture.detectChanges();

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      expect(event).toBeTruthy();
      expect(event).toEqual({
        previousIndex: 1,
        currentIndex: 1,
        item: groups[0][1],
        container: dropInstances[0],
        previousContainer: dropInstances[0],
        isPointerOverContainer: false,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });
    });

    it("should call the `enterPredicate` with the item and the container it is entering", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const dropInstances = fixture.componentInstance.dropInstances.toArray();
      const spy = jasmine.createSpy("enterPredicate spy").and.returnValue(true);
      const groups = fixture.componentInstance.groupedDragItems.slice();
      const dragItem = groups[0][1];
      const targetRect = groups[1][2].element.getBoundingClientRect();

      dropInstances[1].enterPredicate = spy;
      fixture.detectChanges();

      dragElementViaMouse(fixture, dragItem.element, targetRect.left + 1, targetRect.top + 1);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(spy).toHaveBeenCalledWith(dragItem, dropInstances[1]);
    });

    it("should be able to start dragging after an item has been transferred", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const element = groups[0][1].element;
      const dropZone = fixture.componentInstance.dropInstances.toArray()[1].element;
      const targetRect = dropZone.getBoundingClientRect();

      // Drag the element into the drop zone and move it to the top.
      for (const offset of [1, -1]) {
        dragElementViaMouse(fixture, element, targetRect.left + offset, targetRect.top + offset);
        await fixture.whenStable();
        fixture.detectChanges();
      }

      await assertStartToEndSorting("vertical", fixture, config.getSortedSiblings, Array.from(dropZone.querySelectorAll(".cdk-drag")));
    });

    it("should be able to return the last item inside its initial container", async () => {
      const fixture = createComponent(ConnectedDropZones);

      // Make sure there's only one item in the first list.
      fixture.componentInstance.todo = ["things"];
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const dropZones = fixture.componentInstance.dropInstances.map((d) => d.element);
      const item = groups[0][0];
      const initialRect = item.element.getBoundingClientRect();
      const targetRect = groups[1][0].element.getBoundingClientRect();

      startDraggingViaMouse(fixture, item.element);

      const placeholder = dropZones[0].querySelector(".cdk-drag-placeholder")!;

      expect(placeholder).toBeTruthy();

      expect(dropZones[0].contains(placeholder), "Expected placeholder to be inside the first container.").toBe(true);

      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.top + 1);
      fixture.detectChanges();

      expect(dropZones[1].contains(placeholder), "Expected placeholder to be inside second container.").toBe(true);

      dispatchMouseEvent(document, "mousemove", initialRect.left + 1, initialRect.top + 1);
      fixture.detectChanges();

      expect(dropZones[0].contains(placeholder), "Expected placeholder to be back inside first container.").toBe(true);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).not.toHaveBeenCalled();
    });

    it("should update drop zone after element has entered", async () => {
      const fixture = createComponent(ConnectedDropZones);

      // Make sure there's only one item in the first list.
      fixture.componentInstance.todo = ["things"];
      fixture.detectChanges();

      const dropInstances = fixture.componentInstance.dropInstances.toArray();
      const groups = fixture.componentInstance.groupedDragItems;
      const dropZones = dropInstances.map((d) => d.element);
      const item = groups[0][0];
      const initialTargetZoneRect = dropZones[1].getBoundingClientRect();
      const targetElement = groups[1][groups[1].length - 1].element;
      let targetRect = targetElement.getBoundingClientRect();

      startDraggingViaMouse(fixture, item.element);

      const placeholder = dropZones[0].querySelector(".cdk-drag-placeholder")!;

      expect(placeholder).toBeTruthy();

      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.top + 1);
      fixture.detectChanges();

      expect(targetElement.previousSibling === placeholder, "Expected placeholder to be inside second container before last item.").toBe(true);

      // Update target rect
      targetRect = targetElement.getBoundingClientRect();
      expect(initialTargetZoneRect.bottom <= targetRect.top, "Expected target rect to be outside of initial target zone rect").toBe(true);

      // Swap with target
      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.bottom - 1);
      fixture.detectChanges();

      // Drop and verify item drop positon and coontainer
      dispatchMouseEvent(document, "mouseup", targetRect.left + 1, targetRect.bottom - 1);
      await fixture.whenStable();
      fixture.detectChanges();

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      expect(event).toBeTruthy();
      expect(event).toEqual({
        previousIndex: 0,
        currentIndex: 3,
        item: item,
        container: dropInstances[1],
        previousContainer: dropInstances[0],
        isPointerOverContainer: true,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });
    });

    it("should enter as first child if entering from top", async () => {
      const fixture = createComponent(ConnectedDropZones);

      // Make sure there's only one item in the first list.
      fixture.componentInstance.todo = ["things"];
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const dropZones = fixture.componentInstance.dropInstances.map((d) => d.element);
      const item = groups[0][0];

      // Add some initial padding as the target drop zone
      dropZones[1].style.paddingTop = "10px";

      const targetRect = dropZones[1].getBoundingClientRect();

      startDraggingViaMouse(fixture, item.element);

      const placeholder = dropZones[0].querySelector(".cdk-drag-placeholder")!;

      expect(placeholder).toBeTruthy();

      expect(dropZones[0].contains(placeholder), "Expected placeholder to be inside the first container.").toBe(true);

      dispatchMouseEvent(document, "mousemove", targetRect.left, targetRect.top);
      fixture.detectChanges();

      expect(dropZones[1].firstElementChild === placeholder, "Expected placeholder to be first child inside second container.").toBe(true);

      dispatchMouseEvent(document, "mouseup");
    });

    it("should not throw when entering from the top with an intermediate sibling present", async () => {
      const fixture = createComponent(ConnectedDropZonesWithIntermediateSibling);

      // Make sure there's only one item in the first list.
      fixture.componentInstance.todo = ["things"];
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const dropZones = fixture.componentInstance.dropInstances.map((d) => d.element);
      const item = groups[0][0];

      // Add some initial padding as the target drop zone
      dropZones[1].style.paddingTop = "10px";
      const targetRect = dropZones[1].getBoundingClientRect();

      dragElementViaMouse(fixture, item.element, targetRect.left, targetRect.top);
      await fixture.whenStable();
      fixture.detectChanges();
    });

    it("should assign a default id on each drop zone", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      expect(
        fixture.componentInstance.dropInstances.toArray().every((dropZone) => {
          return !!dropZone.id && !!dropZone.element.getAttribute("id");
        }),
      ).toBe(true);
    });

    it("should be able to connect two drop zones by id", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const [todoDropInstance, doneDropInstance] = fixture.componentInstance.dropInstances.toArray();

      fixture.componentInstance.todoConnectedTo.set([doneDropInstance.id]);
      fixture.componentInstance.doneConnectedTo.set([todoDropInstance.id]);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const element = groups[0][1].element;
      const targetRect = groups[1][2].element.getBoundingClientRect();

      dragElementViaMouse(fixture, element, targetRect.left + 1, targetRect.top + 1);
      await fixture.whenStable();
      fixture.detectChanges();

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      expect(event).toBeTruthy();
      expect(event).toEqual({
        previousIndex: 1,
        currentIndex: 3,
        item: groups[0][1],
        container: doneDropInstance,
        previousContainer: todoDropInstance,
        isPointerOverContainer: true,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });
    });

    it("should be able to connect two drop zones using the drop list group", async () => {
      const fixture = createComponent(ConnectedDropZonesViaGroupDirective);
      fixture.detectChanges();

      const dropInstances = fixture.componentInstance.dropInstances.toArray();
      const groups = fixture.componentInstance.groupedDragItems;
      const element = groups[0][1].element;
      const targetRect = groups[1][2].element.getBoundingClientRect();

      dragElementViaMouse(fixture, element, targetRect.left + 1, targetRect.top + 1);
      await fixture.whenStable();
      fixture.detectChanges();

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      expect(event).toBeTruthy();
      expect(event).toEqual({
        previousIndex: 1,
        currentIndex: 3,
        item: groups[0][1],
        container: dropInstances[1],
        previousContainer: dropInstances[0],
        isPointerOverContainer: true,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });
    });

    it("should be able to pass a single id to `connectedTo`", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const [todoDropInstance, doneDropInstance] = fixture.componentInstance.dropInstances.toArray();

      fixture.componentInstance.todoConnectedTo.set([doneDropInstance.id]);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const element = groups[0][1].element;
      const targetRect = groups[1][2].element.getBoundingClientRect();

      dragElementViaMouse(fixture, element, targetRect.left + 1, targetRect.top + 1);
      await fixture.whenStable();
      fixture.detectChanges();

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      expect(event).toBeTruthy();
      expect(event).toEqual({
        previousIndex: 1,
        currentIndex: 3,
        item: groups[0][1],
        container: doneDropInstance,
        previousContainer: todoDropInstance,
        isPointerOverContainer: true,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });
    });

    it("should return DOM element to its initial container after it is dropped, in a container with one draggable item", async () => {
      const fixture = createComponent(ConnectedDropZonesWithSingleItems);
      fixture.detectChanges();

      const items = fixture.componentInstance.dragItems.toArray();
      const item = items[0];
      const targetRect = items[1].element.getBoundingClientRect();
      const dropContainers = fixture.componentInstance.dropInstances.map((drop) => drop.element);

      expect(dropContainers[0].contains(item.element), "Expected DOM element to be in first container").toBe(true);
      expect(item.dropContainer, "Expected CdkDrag to be in first container in memory").toBe(fixture.componentInstance.dropInstances.first);

      dragElementViaMouse(fixture, item.element, targetRect.left + 1, targetRect.top + 1);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      expect(event).toEqual({
        previousIndex: 0,
        currentIndex: 0,
        item,
        container: fixture.componentInstance.dropInstances.toArray()[1],
        previousContainer: fixture.componentInstance.dropInstances.first,
        isPointerOverContainer: true,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });

      expect(dropContainers[0].contains(item.element), "Expected DOM element to be returned to first container").toBe(true);
      expect(item.dropContainer, "Expected CdkDrag to be returned to first container in memory").toBe(fixture.componentInstance.dropInstances.first);
    });

    it("should be able to return an element to its initial container in the same sequence, even if it is not connected to the current container", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const [todoDropInstance, doneDropInstance] = fixture.componentInstance.dropInstances.toArray();
      const todoZone = todoDropInstance.element;
      const doneZone = doneDropInstance.element;
      const item = groups[0][1];
      const initialRect = item.element.getBoundingClientRect();
      const targetRect = groups[1][2].element.getBoundingClientRect();

      // Change the `connectedTo` so the containers are only connected one-way.
      fixture.componentInstance.todoConnectedTo.set([doneDropInstance]);
      fixture.componentInstance.doneConnectedTo.set([]);
      fixture.detectChanges();

      startDraggingViaMouse(fixture, item.element);
      fixture.detectChanges();

      const placeholder = todoZone.querySelector(".cdk-drag-placeholder")!;

      expect(placeholder).toBeTruthy();
      expect(todoZone.contains(placeholder), "Expected placeholder to be inside the first container.").toBe(true);

      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.top + 1);
      fixture.detectChanges();

      expect(doneZone.contains(placeholder), "Expected placeholder to be inside second container.").toBe(true);

      dispatchMouseEvent(document, "mousemove", initialRect.left + 1, initialRect.top + 1);
      fixture.detectChanges();

      expect(todoZone.contains(placeholder), "Expected placeholder to be back inside first container.").toBe(true);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).not.toHaveBeenCalled();
    });

    it("should not add child drop lists to the same group as their parents", async () => {
      const fixture = createComponent(NestedDropListGroups);
      const component = fixture.componentInstance;
      fixture.detectChanges();

      expect(Array.from(component.group._items)).toEqual([component.listOne, component.listTwo]);
    });

    it("should not be able to drop an element into a container that is under another element", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems.slice();
      const element = groups[0][1].element;
      const dropInstances = fixture.componentInstance.dropInstances.toArray();
      const targetRect = groups[1][2].element.getBoundingClientRect();
      const coverElement = document.createElement("div");
      const targetGroupRect = dropInstances[1].element.getBoundingClientRect();

      // Add an extra element that covers the target container.
      fixture.nativeElement.appendChild(coverElement);
      extendStyles(coverElement.style, {
        position: "fixed",
        top: targetGroupRect.top + "px",
        left: targetGroupRect.left + "px",
        bottom: targetGroupRect.bottom + "px",
        right: targetGroupRect.right + "px",
        background: "orange",
      });

      dragElementViaMouse(fixture, element, targetRect.left + 1, targetRect.top + 1);
      await fixture.whenStable();
      fixture.detectChanges();

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      expect(event).toBeTruthy();
      expect(event).toEqual({
        previousIndex: 1,
        currentIndex: 1,
        item: groups[0][1],
        container: dropInstances[0],
        previousContainer: dropInstances[0],
        isPointerOverContainer: false,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });
    });

    it("should set a class when a container can receive an item", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const dropZones = fixture.componentInstance.dropInstances.map((d) => d.element);
      const item = fixture.componentInstance.groupedDragItems[0][1];

      expect(
        dropZones.every((c) => !c.classList.contains("cdk-drop-list-receiving")),
        "Expected neither of the containers to have the class.",
      ).toBe(true);

      startDraggingViaMouse(fixture, item.element);
      fixture.detectChanges();

      expect(dropZones[0].classList, "Expected source container not to have the receiving class.").not.toContain("cdk-drop-list-receiving");

      expect(dropZones[1].classList, "Expected target container to have the receiving class.").toContain("cdk-drop-list-receiving");
    });

    it("should toggle the `receiving` class when the item enters a new list", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const dropZones = fixture.componentInstance.dropInstances.map((d) => d.element);
      const item = groups[0][1];
      const targetRect = groups[1][2].element.getBoundingClientRect();

      expect(
        dropZones.every((c) => !c.classList.contains("cdk-drop-list-receiving")),
        "Expected neither of the containers to have the class.",
      ).toBe(true);

      startDraggingViaMouse(fixture, item.element);

      expect(dropZones[0].classList, "Expected source container not to have the receiving class.").not.toContain("cdk-drop-list-receiving");

      expect(dropZones[1].classList, "Expected target container to have the receiving class.").toContain("cdk-drop-list-receiving");

      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.top + 1);
      fixture.detectChanges();

      expect(dropZones[0].classList, "Expected old container to have the receiving class after exiting.").toContain("cdk-drop-list-receiving");

      expect(dropZones[1].classList, "Expected new container not to have the receiving class after exiting.").not.toContain("cdk-drop-list-receiving");
    });

    it("should not set the receiving class if the item does not match the enter predicate", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();
      fixture.componentInstance.dropInstances.toArray()[1].enterPredicate = () => false;

      const dropZones = fixture.componentInstance.dropInstances.map((d) => d.element);
      const item = fixture.componentInstance.groupedDragItems[0][1];

      expect(
        dropZones.every((c) => !c.classList.contains("cdk-drop-list-receiving")),
        "Expected neither of the containers to have the class.",
      ).toBe(true);

      startDraggingViaMouse(fixture, item.element);
      fixture.detectChanges();

      expect(
        dropZones.every((c) => !c.classList.contains("cdk-drop-list-receiving")),
        "Expected neither of the containers to have the class.",
      ).toBe(true);
    });

    it("should set the receiving class on the source container, even if the enter predicate does not match", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();
      fixture.componentInstance.dropInstances.toArray()[0].enterPredicate = () => false;

      const groups = fixture.componentInstance.groupedDragItems;
      const dropZones = fixture.componentInstance.dropInstances.map((d) => d.element);
      const item = groups[0][1];
      const targetRect = groups[1][2].element.getBoundingClientRect();

      expect(
        dropZones.every((c) => !c.classList.contains("cdk-drop-list-receiving")),
        "Expected neither of the containers to have the class.",
      ).toBe(true);

      startDraggingViaMouse(fixture, item.element);

      expect(dropZones[0].classList, "Expected source container not to have the receiving class.").not.toContain("cdk-drop-list-receiving");

      expect(dropZones[1].classList, "Expected target container to have the receiving class.").toContain("cdk-drop-list-receiving");

      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.top + 1);
      fixture.detectChanges();

      expect(dropZones[0].classList, "Expected old container to have the receiving class after exiting.").toContain("cdk-drop-list-receiving");

      expect(dropZones[1].classList, "Expected new container not to have the receiving class after exiting.").not.toContain("cdk-drop-list-receiving");
    });

    it("should set the receiving class when the list is wrapped in an OnPush component", async () => {
      const fixture = createComponent(ConnectedDropListsInOnPush);
      fixture.detectChanges();

      const dropZones = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll(".cdk-drop-list"));
      const item = dropZones[0].querySelector(".cdk-drag")!;

      expect(
        dropZones.every((c) => !c.classList.contains("cdk-drop-list-receiving")),
        "Expected neither of the containers to have the class.",
      ).toBe(true);

      startDraggingViaMouse(fixture, item);
      fixture.detectChanges();

      expect(dropZones[0].classList, "Expected source container not to have the receiving class.").not.toContain("cdk-drop-list-receiving");

      expect(dropZones[1].classList, "Expected target container to have the receiving class.").toContain("cdk-drop-list-receiving");
    });

    it("should be able to move the item over an intermediate container before dropping it into the final one", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const [todoDropInstance, doneDropInstance, extraDropInstance] = fixture.componentInstance.dropInstances.toArray();
      fixture.componentInstance.todoConnectedTo.set([doneDropInstance, extraDropInstance]);
      fixture.componentInstance.doneConnectedTo.set([]);
      fixture.componentInstance.extraConnectedTo.set([]);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const todoZone = todoDropInstance.element;
      const doneZone = doneDropInstance.element;
      const extraZone = extraDropInstance.element;
      const item = groups[0][1];
      const intermediateRect = doneZone.getBoundingClientRect();
      const finalRect = extraZone.getBoundingClientRect();

      startDraggingViaMouse(fixture, item.element);

      const placeholder = todoZone.querySelector(".cdk-drag-placeholder")!;

      expect(placeholder).toBeTruthy();
      expect(todoZone.contains(placeholder), "Expected placeholder to be inside the first container.").toBe(true);

      dispatchMouseEvent(document, "mousemove", intermediateRect.left + 1, intermediateRect.top + 1);
      fixture.detectChanges();

      expect(doneZone.contains(placeholder), "Expected placeholder to be inside second container.").toBe(true);

      dispatchMouseEvent(document, "mousemove", finalRect.left + 1, finalRect.top + 1);
      fixture.detectChanges();

      expect(extraZone.contains(placeholder), "Expected placeholder to be inside third container.").toBe(true);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      expect(event).toBeTruthy();
      expect(event).toEqual(
        jasmine.objectContaining({
          previousIndex: 1,
          currentIndex: 0,
          item: groups[0][1],
          container: extraDropInstance,
          previousContainer: todoDropInstance,
          isPointerOverContainer: false,
          distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
          dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
          event: jasmine.anything(),
        }),
      );
    });

    it("should not be able to move an item into a drop container that the initial container is not connected to by passing it over an intermediate one that is", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const [todoDropInstance, doneDropInstance, extraDropInstance] = fixture.componentInstance.dropInstances.toArray();
      fixture.componentInstance.todoConnectedTo.set([doneDropInstance]);
      fixture.componentInstance.doneConnectedTo.set([todoDropInstance, extraDropInstance]);
      fixture.componentInstance.extraConnectedTo.set([doneDropInstance]);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const todoZone = todoDropInstance.element;
      const doneZone = doneDropInstance.element;
      const extraZone = extraDropInstance.element;
      const item = groups[0][1];
      const intermediateRect = doneZone.getBoundingClientRect();
      const finalRect = extraZone.getBoundingClientRect();

      startDraggingViaMouse(fixture, item.element);

      const placeholder = todoZone.querySelector(".cdk-drag-placeholder")!;

      expect(placeholder).toBeTruthy();
      expect(todoZone.contains(placeholder), "Expected placeholder to be inside the first container.").toBe(true);

      dispatchMouseEvent(document, "mousemove", intermediateRect.left + 1, intermediateRect.top + 1);
      fixture.detectChanges();

      expect(doneZone.contains(placeholder), "Expected placeholder to be inside second container.").toBe(true);

      dispatchMouseEvent(document, "mousemove", finalRect.left + 1, finalRect.top + 1);
      fixture.detectChanges();

      expect(doneZone.contains(placeholder), "Expected placeholder to remain in the second container.").toBe(true);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      expect(event).toBeTruthy();
      expect(event).toEqual(
        jasmine.objectContaining({
          previousIndex: 1,
          currentIndex: 1,
          item: groups[0][1],
          container: doneDropInstance,
          previousContainer: todoDropInstance,
          isPointerOverContainer: false,
        }),
      );
    });

    it("should return the item to its initial position, if sorting in the source container was disabled", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const dropZones = fixture.componentInstance.dropInstances.map((d) => d.element);
      const item = groups[0][1];
      const targetRect = groups[1][2].element.getBoundingClientRect();

      fixture.componentInstance.dropInstances.first.sortingDisabled = true;
      startDraggingViaMouse(fixture, item.element);

      const placeholder = dropZones[0].querySelector(".cdk-drag-placeholder")!;

      expect(placeholder).toBeTruthy();
      expect(dropZones[0].contains(placeholder), "Expected placeholder to be inside the first container.").toBe(true);
      expect(config.getSortedSiblings(placeholder, "top").indexOf(placeholder), "Expected placeholder to be at item index.").toBe(1);

      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.top + 1);
      fixture.detectChanges();

      expect(dropZones[1].contains(placeholder), "Expected placeholder to be inside second container.").toBe(true);
      expect(config.getSortedSiblings(placeholder, "top").indexOf(placeholder), "Expected placeholder to be at the target index.").toBe(3);

      const firstInitialSiblingRect = groups[0][0].element.getBoundingClientRect();

      // Return the item to an index that is different from the initial one.
      dispatchMouseEvent(document, "mousemove", firstInitialSiblingRect.left + 1, firstInitialSiblingRect.top + 1);
      fixture.detectChanges();

      expect(dropZones[0].contains(placeholder), "Expected placeholder to be back inside first container.").toBe(true);
      expect(config.getSortedSiblings(placeholder, "top").indexOf(placeholder), "Expected placeholder to be back at the initial index.").toBe(1);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).not.toHaveBeenCalled();
    });

    it("should enter an item into the correct index when returning to the initial container, if sorting is enabled", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const dropZones = fixture.componentInstance.dropInstances.map((d) => d.element);
      const item = groups[0][1];
      const targetRect = groups[1][2].element.getBoundingClientRect();

      // Explicitly enable just in case.
      fixture.componentInstance.dropInstances.first.sortingDisabled = false;
      startDraggingViaMouse(fixture, item.element);

      const placeholder = dropZones[0].querySelector(".cdk-drag-placeholder")!;

      expect(placeholder).toBeTruthy();
      expect(dropZones[0].contains(placeholder), "Expected placeholder to be inside the first container.").toBe(true);
      expect(config.getSortedSiblings(placeholder, "top").indexOf(placeholder), "Expected placeholder to be at item index.").toBe(1);

      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.top + 1);
      fixture.detectChanges();

      expect(dropZones[1].contains(placeholder), "Expected placeholder to be inside second container.").toBe(true);
      expect(config.getSortedSiblings(placeholder, "top").indexOf(placeholder), "Expected placeholder to be at the target index.").toBe(3);

      const nextTargetRect = groups[0][3].element.getBoundingClientRect();

      // Return the item to an index that is different from the initial one.
      dispatchMouseEvent(document, "mousemove", nextTargetRect.left + 1, nextTargetRect.top + 1);
      fixture.detectChanges();

      expect(dropZones[0].contains(placeholder), "Expected placeholder to be back inside first container.").toBe(true);
      expect(config.getSortedSiblings(placeholder, "top").indexOf(placeholder), "Expected placeholder to be at the index at which it entered.").toBe(2);
    });

    it("should return the last item to initial position when dragging back into a container with disabled sorting", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const dropZones = fixture.componentInstance.dropInstances.map((d) => d.element);
      const lastIndex = groups[0].length - 1;
      const lastItem = groups[0][lastIndex];
      const targetRect = groups[1][2].element.getBoundingClientRect();

      fixture.componentInstance.dropInstances.first.sortingDisabled = true;
      startDraggingViaMouse(fixture, lastItem.element);

      const placeholder = dropZones[0].querySelector(".cdk-drag-placeholder")!;

      expect(placeholder).toBeTruthy();
      expect(dropZones[0].contains(placeholder), "Expected placeholder to be inside the first container.").toBe(true);
      expect(config.getSortedSiblings(placeholder, "top").indexOf(placeholder), "Expected placeholder to be at item index.").toBe(lastIndex);

      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.top + 1);
      fixture.detectChanges();

      expect(dropZones[1].contains(placeholder), "Expected placeholder to be inside second container.").toBe(true);
      expect(config.getSortedSiblings(placeholder, "top").indexOf(placeholder), "Expected placeholder to be at the target index.").toBe(3);

      const firstInitialSiblingRect = groups[0][0].element.getBoundingClientRect();

      // Return the item to an index that is different from the initial one.
      dispatchMouseEvent(document, "mousemove", firstInitialSiblingRect.left, firstInitialSiblingRect.top);
      fixture.detectChanges();

      expect(dropZones[0].contains(placeholder), "Expected placeholder to be back inside first container.").toBe(true);
      expect(config.getSortedSiblings(placeholder, "top").indexOf(placeholder), "Expected placeholder to be back at the initial index.").toBe(lastIndex);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).not.toHaveBeenCalled();
    });

    it("should toggle a class when dragging an item inside a wrapper component component with OnPush change detection", async () => {
      const fixture = createComponent(ConnectedWrappedDropZones);
      fixture.detectChanges();

      const [startZone, targetZone] = fixture.nativeElement.querySelectorAll(".cdk-drop-list");
      const item = startZone.querySelector(".cdk-drag")!;
      const targetRect = targetZone.getBoundingClientRect();

      expect(startZone.classList, "Expected start not to have dragging class on init.").not.toContain("cdk-drop-list-dragging");
      expect(targetZone.classList, "Expected target not to have dragging class on init.").not.toContain("cdk-drop-list-dragging");

      startDraggingViaMouse(fixture, item);

      expect(startZone.classList, "Expected start to have dragging class after dragging has started.").toContain("cdk-drop-list-dragging");
      expect(targetZone.classList, "Expected target not to have dragging class after dragging has started.").not.toContain("cdk-drop-list-dragging");

      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.top + 1);
      fixture.detectChanges();

      expect(startZone.classList, "Expected start not to have dragging class once item has been moved over.").not.toContain("cdk-drop-list-dragging");
      expect(targetZone.classList, "Expected target to have dragging class once item has been moved over.").toContain("cdk-drop-list-dragging");
    });

    it("should dispatch an event when an item enters a new container", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const item = groups[0][1];
      const targetRect = groups[1][2].element.getBoundingClientRect();

      startDraggingViaMouse(fixture, item.element);

      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.top + 1);
      fixture.detectChanges();

      const containerEnterEvent = fixture.componentInstance.enteredSpy.calls.mostRecent().args[0];
      const itemEnterEvent = fixture.componentInstance.itemEnteredSpy.calls.mostRecent().args[0];
      const expectedEvent: DragEnter = {
        container: fixture.componentInstance.dropInstances.toArray()[1],
        item: item,
        currentIndex: 2,
      };

      expect(containerEnterEvent).toEqual(expectedEvent);
      expect(itemEnterEvent).toEqual(expectedEvent);
    });

    it("should not throw if dragging was interrupted as a result of the entered event", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const item = groups[0][1];
      const targetRect = groups[1][2].element.getBoundingClientRect();

      fixture.componentInstance.enteredSpy.and.callFake(() => {
        fixture.componentInstance.todo = [];
        fixture.detectChanges();
      });

      expect(() => {
        dragElementViaMouse(fixture, item.element, targetRect.left + 1, targetRect.top + 1);
        fixture.detectChanges();
      }).not.toThrow();
    });

    it("should be able to drop into a new container after scrolling into view", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      // Make the page scrollable and scroll the items out of view.
      const cleanup = makeScrollable();
      scrollTo(0, 0);
      dispatchFakeEvent(document, "scroll");
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const item = groups[0][1];

      // Start dragging and then scroll the elements back into view.
      startDraggingViaMouse(fixture, item.element);
      scrollTo(0, 5000);
      dispatchFakeEvent(document, "scroll");

      const targetRect = groups[1][2].element.getBoundingClientRect();
      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.top + 1);
      dispatchMouseEvent(document, "mouseup", targetRect.left + 1, targetRect.top + 1);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      expect(event).toEqual({
        previousIndex: 1,
        currentIndex: 3,
        item,
        container: fixture.componentInstance.dropInstances.toArray()[1],
        previousContainer: fixture.componentInstance.dropInstances.first,
        isPointerOverContainer: true,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });

      cleanup();
    });

    it("should be able to drop into a new container inside the Shadow DOM", async () => {
      // This test is only relevant for Shadow DOM-supporting browsers.
      if (!_supportsShadowDom()) {
        return;
      }

      const fixture = createComponent(ConnectedDropZones, {
        encapsulation: "shadow-dom",
      });
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const item = groups[0][1];
      const targetRect = groups[1][2].element.getBoundingClientRect();

      dragElementViaMouse(fixture, item.element, targetRect.left + 1, targetRect.top + 1);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      expect(event).toEqual({
        previousIndex: 1,
        currentIndex: 3,
        item,
        container: fixture.componentInstance.dropInstances.toArray()[1],
        previousContainer: fixture.componentInstance.dropInstances.first,
        isPointerOverContainer: true,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });
    });

    it("should be able to drop into a new container inside the Shadow DOM and ngIf", async () => {
      // This test is only relevant for Shadow DOM-supporting browsers.
      if (!_supportsShadowDom()) {
        return;
      }

      const fixture = createComponent(ConnectedDropZonesInsideShadowRootWithNgIf, { encapsulation: "shadow-dom" });
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const item = groups[0][1];
      const targetRect = groups[1][2].element.getBoundingClientRect();

      dragElementViaMouse(fixture, item.element, targetRect.left + 1, targetRect.top + 1);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);

      const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

      expect(event).toEqual({
        previousIndex: 1,
        currentIndex: 3,
        item,
        container: fixture.componentInstance.dropInstances.toArray()[1],
        previousContainer: fixture.componentInstance.dropInstances.first,
        isPointerOverContainer: true,
        distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
        dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
        event: jasmine.anything(),
      });
    });

    it("should prevent selection at the shadow root level", async () => {
      // This test is only relevant for Shadow DOM-supporting browsers.
      if (!_supportsShadowDom()) {
        return;
      }

      const fixture = createComponent(ConnectedDropZones, {
        encapsulation: "shadow-dom",
      });
      fixture.detectChanges();

      const shadowRoot = fixture.nativeElement.shadowRoot!;
      const item = fixture.componentInstance.groupedDragItems[0][1];

      startDraggingViaMouse(fixture, item.element);
      fixture.detectChanges();

      const initialSelectStart = dispatchFakeEvent(shadowRoot, "selectstart");
      fixture.detectChanges();
      expect(initialSelectStart.defaultPrevented).toBe(true);

      dispatchMouseEvent(document, "mouseup");
      fixture.detectChanges();
      await fixture.whenStable();

      const afterDropSelectStart = dispatchFakeEvent(shadowRoot, "selectstart");
      fixture.detectChanges();
      expect(afterDropSelectStart.defaultPrevented).toBe(false);
    });

    it("should not throw if its next sibling is removed while dragging", async () => {
      const fixture = createComponent(ConnectedDropZonesWithSingleItems);
      fixture.detectChanges();

      const items = fixture.componentInstance.dragItems.toArray();
      const item = items[0];
      const nextSibling = items[1].element;
      const extraSibling = document.createElement("div");
      const targetRect = nextSibling.getBoundingClientRect();

      // Manually insert an element after the node to simulate an external package.
      nextSibling.parentNode!.insertBefore(extraSibling, nextSibling);

      expect(() => {
        dragElementViaMouse(fixture, item.element, targetRect.left + 1, targetRect.top + 1);
        // Remove the extra node after the element was dropped, but before the animation is over.
        extraSibling.remove();
        fixture.detectChanges();
      }).not.toThrow();
    });

    it("should warn when the connected container ID does not exist", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      fixture.componentInstance.todoConnectedTo.set(["does-not-exist"]);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const element = groups[0][1].element;

      spyOn(console, "warn");
      dragElementViaMouse(fixture, element, 0, 0);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(console.warn).toHaveBeenCalledWith(`CdkDropList could not find connected drop ` + `list with id "does-not-exist"`);
    });

    it("should not be able to start a drag sequence while a connected container is active", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();
      const item = fixture.componentInstance.groupedDragItems[0][0];
      const itemInOtherList = fixture.componentInstance.groupedDragItems[1][0];

      startDraggingViaMouse(fixture, item.element);

      expect(document.querySelectorAll(".cdk-drag-dragging").length, "Expected one item to be dragged initially.").toBe(1);

      startDraggingViaMouse(fixture, itemInOtherList.element);

      expect(document.querySelectorAll(".cdk-drag-dragging").length, "Expected only one item to continue to be dragged.").toBe(1);
    });

    it("should insert the preview inside the shadow root by default", async () => {
      // This test is only relevant for Shadow DOM-supporting browsers.
      if (!_supportsShadowDom()) {
        return;
      }

      const fixture = createComponent(ConnectedDropZones, {
        encapsulation: "shadow-dom",
      });
      fixture.detectChanges();
      const item = fixture.componentInstance.groupedDragItems[0][1];

      startDraggingViaMouse(fixture, item.element);
      fixture.detectChanges();

      // `querySelector` doesn't descend into the shadow DOM so we can assert that the preview
      // isn't at its default location by searching for it at the `document` level.
      expect(document.querySelector(".cdk-drag-preview")).toBeFalsy();
    });
  });

  describe("with nested drags", () => {
    it("should not move draggable container when dragging child (multitouch)", async () => {
      const fixture = createComponent(NestedDragsComponent, { dragDistance: 10 });
      fixture.detectChanges();

      // First finger drags container (less then threshold)
      startDraggingViaTouch(fixture, fixture.componentInstance.container.nativeElement);
      continueDraggingViaTouch(fixture, 2, 0);

      // Second finger drags container
      startDraggingViaTouch(fixture, fixture.componentInstance.container.nativeElement);
      continueDraggingViaTouch(fixture, 0, 10);
      continueDraggingViaTouch(fixture, 0, 20);

      // First finger releases
      stopDraggingViaTouch(fixture, 0, 20);
      // Second finger releases
      stopDraggingViaTouch(fixture, 0, 10);

      // Container spies worked
      const containerDragStartedCount = fixture.componentInstance.containerDragStartedSpy.calls.count();
      const containerDragMovedCount = fixture.componentInstance.containerDragMovedSpy.calls.count();
      const containerDragReleasedCount = fixture.componentInstance.containerDragReleasedSpy.calls.count();

      expect(containerDragStartedCount).toBeGreaterThan(0);
      expect(containerDragMovedCount).toBeGreaterThan(0);
      expect(containerDragReleasedCount).toBeGreaterThan(0);

      // Drag item
      startDraggingViaTouch(fixture, fixture.componentInstance.item.nativeElement);
      continueDraggingViaTouch(fixture, 20, 20);
      continueDraggingViaTouch(fixture, 40, 40);
      stopDraggingViaTouch(fixture, 60, 60);

      // Spies on item worked
      expect(fixture.componentInstance.itemDragStartedSpy).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.itemDragMovedSpy).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.itemDragReleasedSpy).toHaveBeenCalledTimes(1);

      // Spies on container stay intact
      expect(fixture.componentInstance.containerDragStartedSpy).toHaveBeenCalledTimes(containerDragStartedCount);
      expect(fixture.componentInstance.containerDragMovedSpy).toHaveBeenCalledTimes(containerDragMovedCount);
      expect(fixture.componentInstance.containerDragReleasedSpy).toHaveBeenCalledTimes(containerDragReleasedCount);
    });

    it("should stop event propagation when dragging a nested item", () => {
      const fixture = createComponent(NestedDragsComponent);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.item.nativeElement;

      const event = createMouseEvent("mousedown");
      spyOn(event, "stopPropagation").and.callThrough();

      dispatchEvent(dragElement, event);
      fixture.detectChanges();

      expect(event.stopPropagation).toHaveBeenCalled();
    });

    it("should stop event propagation when dragging item nested via ng-template", () => {
      const fixture = createComponent(NestedDragsThroughTemplate);
      fixture.detectChanges();
      const dragElement = fixture.componentInstance.item.nativeElement;

      const event = createMouseEvent("mousedown");
      spyOn(event, "stopPropagation").and.callThrough();

      dispatchEvent(dragElement, event);
      fixture.detectChanges();

      expect(event.stopPropagation).toHaveBeenCalled();
    });
  });

  describe("with an alternate element container", () => {
    it("should move the placeholder into the alternate container of an empty list", () => {
      const fixture = createComponent(ConnectedDropZonesWithAlternateContainer);
      fixture.detectChanges();

      const dropZones = fixture.componentInstance.dropInstances.map((d) => d.element);
      const item = fixture.componentInstance.groupedDragItems[0][1];
      const sourceContainer = dropZones[0].querySelector(".inner-container")!;
      const targetContainer = dropZones[1].querySelector(".inner-container")!;
      const targetRect = targetContainer.getBoundingClientRect();

      startDraggingViaMouse(fixture, item.element);

      const placeholder = dropZones[0].querySelector(".cdk-drag-placeholder")!;

      expect(placeholder).toBeTruthy();
      expect(placeholder.parentNode, "Expected placeholder to be inside the first container.").toBe(sourceContainer);

      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.top + 1);
      fixture.detectChanges();

      expect(placeholder.parentNode, "Expected placeholder to be inside second container.").toBe(targetContainer);
    });

    it("should throw if the items are not inside of the alternate container", async () => {
      await spyOnGlobalErrorsAsync(async (globalErrorSpy) => {
        const fixture = createComponent(DraggableWithInvalidAlternateContainer);
        fixture.detectChanges();

        const item = fixture.componentInstance.dragItems.first.element;
        startDraggingViaMouse(fixture, item);
        await wait(0);

        expect(globalErrorSpy).toHaveBeenCalledWith(
          jasmine.objectContaining({
            message: jasmine.stringMatching(/Invalid DOM structure for drop list\. All items must be placed directly inside of the element container/),
          }),
        );
      });
    });

    it("should throw if the alternate container cannot be found", async () => {
      await spyOnGlobalErrorsAsync(async (globalErrorSpy) => {
        const fixture = createComponent(DraggableWithMissingAlternateContainer);
        fixture.detectChanges();

        const item = fixture.componentInstance.dragItems.first.element;
        startDraggingViaMouse(fixture, item);
        await wait(0);

        expect(globalErrorSpy).toHaveBeenCalledWith(
          jasmine.objectContaining({
            message: jasmine.stringMatching(/CdkDropList could not find an element container matching the selector "does-not-exist"/),
          }),
        );
      });
    });
  });

  describe("with an anchor", () => {
    function getAnchor(container: HTMLElement) {
      return container.querySelector(".cdk-drag-anchor");
    }

    function getPlaceholder(container: HTMLElement) {
      return container.querySelector(".cdk-drag-placeholder");
    }

    it("should create and manage the anchor element when the item is moved into a new container", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.componentInstance.hasAnchor.set(true);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const [sourceContainer, targetContainer] = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll(".cdk-drop-list"));
      const item = groups[0][1];
      const targetRect = groups[1][2].element.getBoundingClientRect();
      const x = targetRect.left + 1;
      const y = targetRect.top + 1;

      expect(getAnchor(fixture.nativeElement)).toBeFalsy();
      expect(getPlaceholder(fixture.nativeElement)).toBeFalsy();

      startDraggingViaMouse(fixture, item.element);
      expect(getAnchor(sourceContainer)).toBeFalsy();
      expect(getPlaceholder(sourceContainer)).toBeTruthy();

      dispatchMouseEvent(document, "mousemove", x, y);
      fixture.detectChanges();
      const anchor = getAnchor(sourceContainer)!;
      expect(anchor).toBeTruthy();
      expect(anchor.textContent).toContain("One");
      expect(anchor.classList).toContain("cdk-drag-anchor");
      expect(anchor.classList).not.toContain("cdk-drag-placeholder");
      expect(getAnchor(targetContainer)).toBeFalsy();
      expect(getPlaceholder(targetContainer)).toBeTruthy();

      dispatchMouseEvent(document, "mouseup", x, y);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(getAnchor(fixture.nativeElement)).toBeFalsy();
      expect(getPlaceholder(fixture.nativeElement)).toBeFalsy();
    });

    it("should remove the anchor when the item is returned to the initial container", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.componentInstance.hasAnchor.set(true);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const [sourceContainer, targetContainer] = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll(".cdk-drop-list"));
      const item = groups[0][1];
      const sourceRect = sourceContainer.getBoundingClientRect();
      const targetRect = targetContainer.getBoundingClientRect();

      expect(getAnchor(fixture.nativeElement)).toBeFalsy();
      expect(getPlaceholder(fixture.nativeElement)).toBeFalsy();

      startDraggingViaMouse(fixture, item.element);
      expect(getAnchor(sourceContainer)).toBeFalsy();
      expect(getPlaceholder(sourceContainer)).toBeTruthy();

      // Move into the second container.
      dispatchMouseEvent(document, "mousemove", targetRect.left + 1, targetRect.top + 1);
      fixture.detectChanges();
      expect(getAnchor(sourceContainer)).toBeTruthy();
      expect(getAnchor(targetContainer)).toBeFalsy();
      expect(getPlaceholder(sourceContainer)).toBeFalsy();
      expect(getPlaceholder(targetContainer)).toBeTruthy();

      // Move back into the source container.
      dispatchMouseEvent(document, "mousemove", sourceRect.left + 1, sourceRect.top + 1);
      fixture.detectChanges();
      expect(getAnchor(sourceContainer)).toBeFalsy();
      expect(getAnchor(targetContainer)).toBeFalsy();
      expect(getPlaceholder(sourceContainer)).toBeTruthy();
      expect(getPlaceholder(targetContainer)).toBeFalsy();

      dispatchMouseEvent(document, "mouseup", sourceRect.left + 1, sourceRect.top + 1);
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(getAnchor(fixture.nativeElement)).toBeFalsy();
      expect(getPlaceholder(fixture.nativeElement)).toBeFalsy();
    });

    it("should keep the anchor inside the initial container as the item is moved between containers", async () => {
      const fixture = createComponent(ConnectedDropZones);
      fixture.detectChanges();

      // By default the drop zones are stacked on top of each other.
      // Lay them out horizontally so the coordinates aren't changing while dragging.
      fixture.nativeElement.style.display = "flex";
      fixture.nativeElement.style.alignItems = "flex-start";

      // The extra zone isn't connected to the others by default.
      fixture.componentInstance.todoConnectedTo.set([fixture.componentInstance.dropInstances.get(1)!, fixture.componentInstance.dropInstances.get(2)!]);
      fixture.componentInstance.hasAnchor.set(true);
      fixture.detectChanges();

      const groups = fixture.componentInstance.groupedDragItems;
      const [sourceContainer, secondContainer, thirdContainer] = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll(".cdk-drop-list"));
      const item = groups[0][1];
      const secondRect = secondContainer.getBoundingClientRect();
      const thirdRect = thirdContainer.getBoundingClientRect();

      expect(getAnchor(fixture.nativeElement)).toBeFalsy();
      expect(getPlaceholder(fixture.nativeElement)).toBeFalsy();

      startDraggingViaMouse(fixture, item.element);
      expect(getAnchor(sourceContainer)).toBeFalsy();
      expect(getPlaceholder(sourceContainer)).toBeTruthy();

      // Move to the second container.
      dispatchMouseEvent(document, "mousemove", secondRect.left + 1, secondRect.top + 1);
      fixture.detectChanges();
      expect(getAnchor(sourceContainer)).toBeTruthy();
      expect(getAnchor(secondContainer)).toBeFalsy();
      expect(getAnchor(thirdContainer)).toBeFalsy();

      expect(getPlaceholder(sourceContainer)).toBeFalsy();
      expect(getPlaceholder(secondContainer)).toBeTruthy();
      expect(getPlaceholder(thirdContainer)).toBeFalsy();

      // Move to the third container.
      dispatchMouseEvent(document, "mousemove", thirdRect.left + 1, thirdRect.top + 1);
      fixture.detectChanges();
      expect(getAnchor(sourceContainer)).toBeTruthy();
      expect(getAnchor(secondContainer)).toBeFalsy();
      expect(getAnchor(thirdContainer)).toBeFalsy();

      expect(getPlaceholder(sourceContainer)).toBeFalsy();
      expect(getPlaceholder(secondContainer)).toBeFalsy();
      expect(getPlaceholder(thirdContainer)).toBeTruthy();

      // Drop the item.
      dispatchMouseEvent(document, "mouseup", thirdRect.left + 1, thirdRect.top + 1);
      fixture.detectChanges();

      await fixture.whenStable();
      fixture.detectChanges();

      expect(getAnchor(fixture.nativeElement)).toBeFalsy();
      expect(getPlaceholder(fixture.nativeElement)).toBeFalsy();
    });
  });
}

/** cdk/platform `_supportsShadowDom` (Chromium: always). */
function _supportsShadowDom(): boolean {
  return typeof document.head.attachShadow === "function";
}
