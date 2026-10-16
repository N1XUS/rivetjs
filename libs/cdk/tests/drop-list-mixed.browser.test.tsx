// Ported from Angular Components (src/cdk/drag-drop/directives/mixed-drop-list.spec.ts), MIT, © Google LLC.
// Changes: shared fixtures from drop-list-fixtures.tsx; `DraggableInHorizontalWrappingDropZone` is a
// `DropListFixture` (styles as a `<style>` with the view, `items` re-render when assigned / on
// `markForCheck()`); instances expose `.element` as the element (`item.element.nativeElement` →
// `item.element`); `@ViewChildren` `QueryList`s are snapshots (re-queried after a drop); `fixture.whenStable()` → `wait(0)`; Jasmine globals from `@rivetjs/testing/jasmine`.
import { afterEach, describe, expect, it, jasmine } from "@rivetjs/testing/jasmine";
import { For } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { Drag, DropList, dropListInstance, moveItemInArray, type DragDrop, type DragInstance, type DropListInstance } from "../drag-drop/index.tsx";
import { createComponent, destroyFixtures, dragElementViaMouse, wait } from "./drag-test-utils.tsx";
import {
  DropListFixture,
  ITEM_HEIGHT,
  ITEM_WIDTH,
  assertEndToStartSorting,
  assertStartToEndSorting,
  defineCommonDropListTests,
  viewDrags,
  type QueryList,
} from "./drop-list-shared.tsx";

afterEach(() => destroyFixtures());

describe("mixed drop list", () => {
  defineCommonDropListTests({
    verticalListOrientation: "mixed",
    horizontalListOrientation: "mixed",
    getSortedSiblings,
  });

  it("should dispatch the `dropped` event in a wrapping drop zone", async () => {
    const fixture = createComponent(DraggableInHorizontalWrappingDropZone);
    fixture.detectChanges();
    const dragItems = fixture.componentInstance.dragItems;

    expect(dragItems.map((drag) => drag.element.textContent!.trim())).toEqual(["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven"]);

    const firstItem = dragItems.first;
    const seventhItemRect = dragItems.toArray()[6].element.getBoundingClientRect();

    dragElementViaMouse(fixture, firstItem.element, seventhItemRect.left + 1, seventhItemRect.top + 1);
    await wait(0);
    fixture.detectChanges();

    expect(fixture.componentInstance.droppedSpy).toHaveBeenCalledTimes(1);
    const event = fixture.componentInstance.droppedSpy.calls.mostRecent().args[0];

    // Assert the event like this, rather than `toHaveBeenCalledWith`, because Jasmine will
    // go into an infinite loop trying to stringify the event, if the test fails.
    expect(event).toEqual({
      previousIndex: 0,
      currentIndex: 6,
      item: firstItem,
      container: fixture.componentInstance.dropInstance,
      previousContainer: fixture.componentInstance.dropInstance,
      isPointerOverContainer: true,
      distance: { x: jasmine.any(Number), y: jasmine.any(Number) },
      dropPoint: { x: jasmine.any(Number), y: jasmine.any(Number) },
      event: jasmine.anything(),
    });

    // Rivet: `QueryList` snapshot (Angular's is live, re-ordered by change detection): query again.
    expect(fixture.componentInstance.dragItems.map((drag) => drag.element.textContent!.trim())).toEqual([
      "One",
      "Two",
      "Three",
      "Four",
      "Five",
      "Six",
      "Zero",
      "Seven",
    ]);
  });

  it("should move the placeholder as an item is being sorted to the right in a wrapping drop zone", async () => {
    const fixture = createComponent(DraggableInHorizontalWrappingDropZone);
    fixture.detectChanges();
    await assertStartToEndSorting(
      "horizontal",
      fixture,
      getSortedSiblings,
      fixture.componentInstance.dragItems.map((item) => item.element),
    );
  });

  it("should move the placeholder as an item is being sorted to the left in a wrapping drop zone", async () => {
    const fixture = createComponent(DraggableInHorizontalWrappingDropZone);
    fixture.detectChanges();
    await assertEndToStartSorting(
      "horizontal",
      fixture,
      getSortedSiblings,
      fixture.componentInstance.dragItems.map((item) => item.element),
    );
  });
});

function getSortedSiblings(item: Element) {
  return Array.from(item.parentElement?.children || []);
}

class DraggableInHorizontalWrappingDropZone extends DropListFixture {
  override styles = `
    .cdk-drop-list {
      display: block;
      width: ${ITEM_WIDTH * 3}px;
      background: pink;
      font-size: 0;
    }

    .cdk-drag {
      height: ${ITEM_HEIGHT * 2}px;
      width: ${ITEM_WIDTH}px;
      background: red;
      display: inline-block;
    }
  `;

  get dragItems(): QueryList<DragInstance> {
    return viewDrags(this.root);
  }
  get dropInstance(): DropListInstance {
    return dropListInstance(this.query(".cdk-drop-list"))!;
  }
  private _items = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven"];
  get items(): string[] {
    this.tracked();
    return this._items;
  }
  set items(value: string[]) {
    this._items = value;
    this.markForCheck();
  }
  droppedSpy = jasmine.createSpy("dropped spy").and.callFake((event: DragDrop<string[]>) => {
    moveItemInArray(this.items, event.previousIndex, event.currentIndex);
    this.markForCheck();
  });

  template(): Content {
    return (
      <DropList orientation="mixed" data={() => this.items} onDropped={(event) => this.droppedSpy(event)}>
        <For each={() => this.items} by={(item) => item}>
          {(item) => <Drag>{item()}</Drag>}
        </For>
      </DropList>
    );
  }
}
