// Ported from angular/components src/cdk/a11y/key-manager/list-key-manager.spec.ts, MIT, © Google LLC.
// QueryList → a signal of items (the manager tracks accessor items with an effect, synchronously);
// jasmine spies → vi mocks; timers → vi fake timers.
import { describe, it, beforeEach, afterEach, vi } from "vitest";
import assert from "node:assert/strict";
import { signal, type Signal } from "@rivetjs/reactivity";
import { ListKeyManager, FocusKeyManager, ActiveDescendantKeyManager, type ListKeyManagerModifierKey, type ListKeyManagerOption } from "../a11y/key-manager.ts";
import type { FocusOrigin } from "../a11y/focus-monitor.ts";

const TAB = 9, PAGE_UP = 33, PAGE_DOWN = 34, END = 35, HOME = 36, LEFT_ARROW = 37, UP_ARROW = 38, RIGHT_ARROW = 39, DOWN_ARROW = 40;

class FakeFocusable {
  disabled: boolean | undefined = false;
  skipItem = false;
  private _label: string;
  constructor(label = "") {
    this._label = label;
  }
  focus(_focusOrigin?: FocusOrigin) {}
  getLabel() {
    return this._label;
  }
}

class FakeHighlightable {
  disabled = false;
  setActiveStyles() {}
  setInactiveStyles() {}
}

interface Modifiers {
  control?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

/** createKeyboardEvent of @angular/cdk/testing/private: a keydown with keyCode / key / modifiers. */
function createKeyboardEvent(type: string, keyCode = 0, key = "", modifiers: Modifiers = {}): KeyboardEvent {
  const event = {
    type,
    keyCode,
    key,
    ctrlKey: !!modifiers.control,
    altKey: !!modifiers.alt,
    shiftKey: !!modifiers.shift,
    metaKey: !!modifiers.meta,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  };
  return event as unknown as KeyboardEvent;
}

/** QueryList stand-in: `reset` + `notifyOnChanges` set the signal. */
class ItemList<T> {
  private _pending: T[] = [];
  readonly items: Signal<T[]> = signal<T[]>([]);
  reset(items: T[]) {
    this._pending = [...items];
  }
  notifyOnChanges() {
    this.items.set(this._pending);
  }
  toArray() {
    return this.items();
  }
  get length() {
    return this.items().length;
  }
}

function calledWith(fn: unknown, value: unknown): boolean {
  return (fn as { mock: { calls: unknown[][] } }).mock.calls.some((c) => c[0] === value);
}

describe("Key managers", () => {
  let itemList: ItemList<any>;
  let fakeKeyEvents: Record<"downArrow" | "upArrow" | "leftArrow" | "rightArrow" | "tab" | "home" | "end" | "unsupported", KeyboardEvent>;

  const wait = (ms: number) => vi.advanceTimersByTime(ms);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    itemList = new ItemList();
    fakeKeyEvents = {
      downArrow: createKeyboardEvent("keydown", DOWN_ARROW),
      upArrow: createKeyboardEvent("keydown", UP_ARROW),
      leftArrow: createKeyboardEvent("keydown", LEFT_ARROW),
      rightArrow: createKeyboardEvent("keydown", RIGHT_ARROW),
      tab: createKeyboardEvent("keydown", TAB),
      home: createKeyboardEvent("keydown", HOME),
      end: createKeyboardEvent("keydown", END),
      unsupported: createKeyboardEvent("keydown", 192), // tilde
    };
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("ListKeyManager", () => {
    let keyManager: ListKeyManager<FakeFocusable>;

    beforeEach(() => {
      itemList.reset([new FakeFocusable("one"), new FakeFocusable("two"), new FakeFocusable("three")]);
      itemList.notifyOnChanges();
      keyManager = new ListKeyManager<FakeFocusable>(itemList.items);
      // first item is already focused
      keyManager.setFirstItemActive();
      vi.spyOn(keyManager, "setActiveItem");
    });

    afterEach(() => {
      keyManager.destroy();
      keyManager = null!;
    });

    it("should maintain the active item if the amount of items changes", () => {
      assert.equal(keyManager.activeItemIndex, 0);
      assert.equal(keyManager.activeItem!.getLabel(), "one");
      itemList.reset([new FakeFocusable("zero"), ...itemList.toArray()]);
      itemList.notifyOnChanges();
      assert.equal(keyManager.activeItemIndex, 1);
      assert.equal(keyManager.activeItem!.getLabel(), "one");
    });

    it("should start off the activeItem as null", () => {
      assert.equal(new ListKeyManager([]).activeItem, null);
    });

    it("should set the activeItem to null if an invalid index is passed in", () => {
      keyManager.setActiveItem(1337);
      assert.equal(keyManager.activeItem, null);
    });

    it("should maintain the active item when the signal-based items change", () => {
      keyManager.destroy();
      const items = signal([new FakeFocusable("one"), new FakeFocusable("two"), new FakeFocusable("three")]);
      keyManager = new ListKeyManager<FakeFocusable>(items);
      keyManager.setFirstItemActive();
      assert.equal(keyManager.activeItemIndex, 0);
      assert.equal(keyManager.activeItem!.getLabel(), "one");
      items.update((current) => [new FakeFocusable("zero"), ...current]);
      assert.equal(keyManager.activeItemIndex, 1);
      assert.equal(keyManager.activeItem!.getLabel(), "one");
    });

    describe("Key events", () => {
      it("should emit tabOut when the tab key is pressed", () => {
        const spy = vi.fn();
        keyManager.tabOut.subscribe(spy);
        keyManager.onKeydown(fakeKeyEvents.tab);
        assert.equal(spy.mock.calls.length, 1);
      });

      it("should complete the tabOut stream on destroy", () => {
        const spy = vi.fn();
        keyManager.tabOut.subscribe({ complete: spy });
        keyManager.destroy();
        assert.equal(spy.mock.calls.length, 1);
      });

      it("should emit tabOut when the tab key is pressed with a modifier", () => {
        const spy = vi.fn();
        keyManager.tabOut.subscribe(spy);
        Object.defineProperty(fakeKeyEvents.tab, "shiftKey", { get: () => true });
        keyManager.onKeydown(fakeKeyEvents.tab);
        assert.equal(spy.mock.calls.length, 1);
      });

      it("should emit an event whenever the active item changes", () => {
        const spy = vi.fn();
        keyManager.change.subscribe(spy);
        keyManager.onKeydown(fakeKeyEvents.downArrow);
        assert.equal(spy.mock.calls.length, 1);
        keyManager.onKeydown(fakeKeyEvents.upArrow);
        assert.equal(spy.mock.calls.length, 2);
      });

      it("should emit if the active item changed, but not the active index", () => {
        const spy = vi.fn();
        keyManager.change.subscribe(spy);
        keyManager.setActiveItem(0);
        itemList.reset([new FakeFocusable("zero"), ...itemList.toArray()]);
        itemList.notifyOnChanges();
        keyManager.setActiveItem(0);
        assert.equal(spy.mock.calls.length, 1);
      });

      it("should complete the change stream on destroy", () => {
        const spy = vi.fn();
        keyManager.change.subscribe({ complete: spy });
        keyManager.destroy();
        assert.equal(spy.mock.calls.length, 1);
      });

      it("should activate the first item when pressing down on a clean key manager", () => {
        keyManager = new ListKeyManager<FakeFocusable>(itemList.items);
        assert.equal(keyManager.activeItemIndex, -1, "Expected active index to default to -1.");
        keyManager.onKeydown(fakeKeyEvents.downArrow);
        assert.equal(keyManager.activeItemIndex, 0, "Expected first item to become active.");
      });

      it("should not prevent the default keyboard action when pressing tab", () => {
        assert.equal(fakeKeyEvents.tab.defaultPrevented, false);
        keyManager.onKeydown(fakeKeyEvents.tab);
        assert.equal(fakeKeyEvents.tab.defaultPrevented, false);
      });

      it("should not do anything for unsupported key presses", () => {
        keyManager.setActiveItem(1);
        assert.equal(keyManager.activeItemIndex, 1);
        assert.equal(fakeKeyEvents.unsupported.defaultPrevented, false);
        keyManager.onKeydown(fakeKeyEvents.unsupported);
        assert.equal(keyManager.activeItemIndex, 1);
        assert.equal(fakeKeyEvents.unsupported.defaultPrevented, false);
      });

      it("should ignore the horizontal keys when only in vertical mode", () => {
        keyManager.withVerticalOrientation().withHorizontalOrientation(null);
        assert.equal(keyManager.activeItemIndex, 0);
        keyManager.onKeydown(fakeKeyEvents.rightArrow);
        assert.equal(keyManager.activeItemIndex, 0);
        assert.equal(fakeKeyEvents.rightArrow.defaultPrevented, false);
      });

      it("should ignore the vertical keys when only in horizontal mode", () => {
        keyManager.withVerticalOrientation(false).withHorizontalOrientation("ltr");
        assert.equal(keyManager.activeItemIndex, 0);
        keyManager.onKeydown(fakeKeyEvents.downArrow);
        assert.equal(keyManager.activeItemIndex, 0);
        assert.equal(fakeKeyEvents.downArrow.defaultPrevented, false);
      });

      describe("withHomeAndEnd", () => {
        beforeEach(() => {
          keyManager.withHomeAndEnd();
        });

        it("should focus the first item when Home is pressed", () => {
          keyManager.setActiveItem(1);
          assert.equal(keyManager.activeItemIndex, 1);
          keyManager.onKeydown(fakeKeyEvents.home);
          assert.equal(keyManager.activeItemIndex, 0);
        });

        it("should focus the last item when End is pressed", () => {
          keyManager.setActiveItem(0);
          assert.equal(keyManager.activeItemIndex, 0);
          keyManager.onKeydown(fakeKeyEvents.end);
          assert.equal(keyManager.activeItemIndex, itemList.length - 1);
        });
      });

      // Rivet addition: the original spec has no PageUp / PageDown cases.
      describe("withPageUpDown", () => {
        beforeEach(() => {
          itemList.reset(Array.from({ length: 25 }, (_, i) => new FakeFocusable(`item ${i}`)));
          itemList.notifyOnChanges();
          keyManager.withPageUpDown(true, 10);
          keyManager.setActiveItem(0);
        });

        it("should move by the delta on PageDown and clamp to the last item", () => {
          keyManager.onKeydown(createKeyboardEvent("keydown", PAGE_DOWN));
          assert.equal(keyManager.activeItemIndex, 10);
          keyManager.onKeydown(createKeyboardEvent("keydown", PAGE_DOWN));
          keyManager.onKeydown(createKeyboardEvent("keydown", PAGE_DOWN));
          assert.equal(keyManager.activeItemIndex, 24);
        });

        it("should move by the delta on PageUp and clamp to the first item", () => {
          keyManager.setActiveItem(15);
          keyManager.onKeydown(createKeyboardEvent("keydown", PAGE_UP));
          assert.equal(keyManager.activeItemIndex, 5);
          keyManager.onKeydown(createKeyboardEvent("keydown", PAGE_UP));
          assert.equal(keyManager.activeItemIndex, 0);
        });

        it("should skip disabled items at the page target", () => {
          itemList.toArray()[10]!.disabled = true;
          keyManager.onKeydown(createKeyboardEvent("keydown", PAGE_DOWN));
          assert.equal(keyManager.activeItemIndex, 9);
        });

        it("should ignore PageUp / PageDown when disabled", () => {
          keyManager.withPageUpDown(false);
          const event = createKeyboardEvent("keydown", PAGE_DOWN);
          keyManager.onKeydown(event);
          assert.equal(keyManager.activeItemIndex, 0);
          assert.equal(event.defaultPrevented, false);
        });
      });

      for (const [name, setup, next, prev] of [
        ["with `vertical` direction", (m: ListKeyManager<FakeFocusable>) => m.withVerticalOrientation(), DOWN_ARROW, UP_ARROW],
        ["with `ltr` direction", (m: ListKeyManager<FakeFocusable>) => m.withHorizontalOrientation("ltr"), RIGHT_ARROW, LEFT_ARROW],
        ["with `rtl` direction", (m: ListKeyManager<FakeFocusable>) => m.withHorizontalOrientation("rtl"), LEFT_ARROW, RIGHT_ARROW],
      ] as const) {
        describe(name, () => {
          const context = {} as { nextKeyEvent: KeyboardEvent; prevKeyEvent: KeyboardEvent };
          beforeEach(() => {
            setup(keyManager);
            context.nextKeyEvent = createKeyboardEvent("keydown", next);
            context.prevKeyEvent = createKeyboardEvent("keydown", prev);
          });
          runDirectionalKeyTests(context);
        });
      }

      function runDirectionalKeyTests(ctx: { nextKeyEvent: KeyboardEvent; prevKeyEvent: KeyboardEvent }) {
        it("should set subsequent items as active when the next key is pressed", () => {
          keyManager.onKeydown(ctx.nextKeyEvent);
          assert.equal(keyManager.activeItemIndex, 1, "Expected active item to be 1 after one next key event.");
          assert.ok(!calledWith(keyManager.setActiveItem, 0));
          assert.ok(calledWith(keyManager.setActiveItem, 1));
          assert.ok(!calledWith(keyManager.setActiveItem, 2));
          keyManager.onKeydown(ctx.nextKeyEvent);
          assert.equal(keyManager.activeItemIndex, 2, "Expected active item to be 2 after two next key events.");
          assert.ok(calledWith(keyManager.setActiveItem, 2));
          assert.ok(!calledWith(keyManager.setActiveItem, 0));
        });

        it("should set first item active when the next key is pressed if no active item", () => {
          keyManager.setActiveItem(-1);
          keyManager.onKeydown(ctx.nextKeyEvent);
          assert.equal(keyManager.activeItemIndex, 0);
          assert.ok(calledWith(keyManager.setActiveItem, 0));
          assert.ok(!calledWith(keyManager.setActiveItem, 1));
          assert.ok(!calledWith(keyManager.setActiveItem, 2));
        });

        it("should set previous items as active when the previous key is pressed", () => {
          keyManager.onKeydown(ctx.nextKeyEvent);
          assert.equal(keyManager.activeItemIndex, 1);
          assert.ok(!calledWith(keyManager.setActiveItem, 0));
          assert.ok(calledWith(keyManager.setActiveItem, 1));
          keyManager.onKeydown(ctx.prevKeyEvent);
          assert.equal(keyManager.activeItemIndex, 0);
          assert.ok(calledWith(keyManager.setActiveItem, 0));
        });

        it("should do nothing when the prev key is pressed if no active item and not wrap", () => {
          keyManager.setActiveItem(-1);
          keyManager.onKeydown(ctx.prevKeyEvent);
          assert.equal(keyManager.activeItemIndex, -1);
          assert.ok(!calledWith(keyManager.setActiveItem, 0));
          assert.ok(!calledWith(keyManager.setActiveItem, 1));
          assert.ok(!calledWith(keyManager.setActiveItem, 2));
        });

        it("should skip disabled items", () => {
          const items = itemList.toArray();
          items[1].disabled = true;
          itemList.reset(items);
          itemList.notifyOnChanges();
          keyManager.onKeydown(ctx.nextKeyEvent);
          assert.equal(keyManager.activeItemIndex, 2);
          assert.ok(!calledWith(keyManager.setActiveItem, 0));
          assert.ok(!calledWith(keyManager.setActiveItem, 1));
          assert.ok(calledWith(keyManager.setActiveItem, 2));
          keyManager.onKeydown(ctx.prevKeyEvent);
          assert.equal(keyManager.activeItemIndex, 0);
          assert.ok(calledWith(keyManager.setActiveItem, 0));
          assert.ok(!calledWith(keyManager.setActiveItem, 1));
        });

        it("should work normally when disabled property does not exist", () => {
          const items = itemList.toArray();
          items[0].disabled = undefined;
          items[1].disabled = undefined;
          items[2].disabled = undefined;
          itemList.reset(items);
          itemList.notifyOnChanges();
          keyManager.onKeydown(ctx.nextKeyEvent);
          assert.equal(keyManager.activeItemIndex, 1);
          assert.ok(!calledWith(keyManager.setActiveItem, 0));
          assert.ok(calledWith(keyManager.setActiveItem, 1));
          assert.ok(!calledWith(keyManager.setActiveItem, 2));
          keyManager.onKeydown(ctx.nextKeyEvent);
          assert.equal(keyManager.activeItemIndex, 2);
          assert.ok(!calledWith(keyManager.setActiveItem, 0));
          assert.ok(calledWith(keyManager.setActiveItem, 2));
        });

        it("should not move active item past either end of the list", () => {
          keyManager.onKeydown(ctx.nextKeyEvent);
          keyManager.onKeydown(ctx.nextKeyEvent);
          assert.equal(keyManager.activeItemIndex, 2);
          keyManager.onKeydown(ctx.nextKeyEvent);
          assert.equal(keyManager.activeItemIndex, 2);
          keyManager.onKeydown(ctx.prevKeyEvent);
          keyManager.onKeydown(ctx.prevKeyEvent);
          assert.equal(keyManager.activeItemIndex, 0);
          keyManager.onKeydown(ctx.prevKeyEvent);
          assert.equal(keyManager.activeItemIndex, 0);
        });

        it("should not move active item to end when the last item is disabled", () => {
          const items = itemList.toArray();
          items[2].disabled = true;
          itemList.reset(items);
          itemList.notifyOnChanges();
          keyManager.onKeydown(ctx.nextKeyEvent);
          assert.equal(keyManager.activeItemIndex, 1);
          keyManager.onKeydown(ctx.nextKeyEvent);
          assert.equal(keyManager.activeItemIndex, 1);
          assert.ok(!calledWith(keyManager.setActiveItem, 2));
        });

        it("should prevent the default keyboard action of handled events", () => {
          assert.equal(ctx.nextKeyEvent.defaultPrevented, false);
          keyManager.onKeydown(ctx.nextKeyEvent);
          assert.equal(ctx.nextKeyEvent.defaultPrevented, true);
          assert.equal(ctx.prevKeyEvent.defaultPrevented, false);
          keyManager.onKeydown(ctx.prevKeyEvent);
          assert.equal(ctx.prevKeyEvent.defaultPrevented, true);
        });

        for (const [label, modifier] of [
          ["alt", "altKey"],
          ["control", "ctrlKey"],
          ["meta", "metaKey"],
          ["shift", "shiftKey"],
        ] as const) {
          it(`should not do anything for arrow keys if the ${label} key is held down`, () => runModifierKeyTest(ctx, modifier));
        }

        // Rivet addition: allowed modifiers (withAllowedModifierKeys) are not covered by the original.
        it("should move with an allowed modifier held down", () => {
          keyManager.withAllowedModifierKeys(["shiftKey"]);
          Object.defineProperty(ctx.nextKeyEvent, "shiftKey", { get: () => true });
          keyManager.onKeydown(ctx.nextKeyEvent);
          assert.equal(keyManager.activeItemIndex, 1);
          assert.equal(ctx.nextKeyEvent.defaultPrevented, true);
        });
      }

      function runModifierKeyTest(context: { nextKeyEvent: KeyboardEvent; prevKeyEvent: KeyboardEvent }, modifier: ListKeyManagerModifierKey) {
        const initialActiveIndex = keyManager.activeItemIndex;
        const spy = vi.fn();
        keyManager.change.subscribe(spy);
        assert.equal(context.nextKeyEvent.defaultPrevented, false);
        assert.equal(context.prevKeyEvent.defaultPrevented, false);
        Object.defineProperty(context.nextKeyEvent, modifier, { get: () => true });
        Object.defineProperty(context.prevKeyEvent, modifier, { get: () => true });
        keyManager.onKeydown(context.nextKeyEvent);
        assert.equal(context.nextKeyEvent.defaultPrevented, false);
        assert.equal(keyManager.activeItemIndex, initialActiveIndex);
        assert.equal(spy.mock.calls.length, 0);
        keyManager.onKeydown(context.prevKeyEvent);
        assert.equal(context.prevKeyEvent.defaultPrevented, false);
        assert.equal(keyManager.activeItemIndex, initialActiveIndex);
        assert.equal(spy.mock.calls.length, 0);
      }
    });

    describe("programmatic focus", () => {
      it("should setActiveItem()", () => {
        assert.equal(keyManager.activeItemIndex, 0);
        keyManager.setActiveItem(1);
        assert.equal(keyManager.activeItemIndex, 1);
      });

      it("should be able to set the active item by reference", () => {
        assert.equal(keyManager.activeItemIndex, 0);
        keyManager.setActiveItem(itemList.toArray()[2]);
        assert.equal(keyManager.activeItemIndex, 2);
      });

      it("should be able to set the active item without emitting an event", () => {
        const spy = vi.fn();
        keyManager.change.subscribe(spy);
        assert.equal(keyManager.activeItemIndex, 0);
        keyManager.updateActiveItem(2);
        assert.equal(keyManager.activeItemIndex, 2);
        assert.equal(spy.mock.calls.length, 0);
      });

      it("should expose the active item correctly", () => {
        keyManager.onKeydown(fakeKeyEvents.downArrow);
        assert.equal(keyManager.activeItemIndex, 1);
        assert.equal(keyManager.activeItem, itemList.toArray()[1]);
        keyManager.onKeydown(fakeKeyEvents.downArrow);
        assert.equal(keyManager.activeItemIndex, 2);
        assert.equal(keyManager.activeItem, itemList.toArray()[2]);
      });

      it("should setFirstItemActive()", () => {
        keyManager.onKeydown(fakeKeyEvents.downArrow);
        keyManager.onKeydown(fakeKeyEvents.downArrow);
        assert.equal(keyManager.activeItemIndex, 2);
        keyManager.setFirstItemActive();
        assert.equal(keyManager.activeItemIndex, 0);
      });

      it("should set the active item to the second item if the first one is disabled", () => {
        const items = itemList.toArray();
        items[0].disabled = true;
        itemList.reset(items);
        itemList.notifyOnChanges();
        keyManager.setFirstItemActive();
        assert.equal(keyManager.activeItemIndex, 1);
      });

      it("should setLastItemActive()", () => {
        assert.equal(keyManager.activeItemIndex, 0);
        keyManager.setLastItemActive();
        assert.equal(keyManager.activeItemIndex, 2);
      });

      it("should set the active item to the second to last item if the last is disabled", () => {
        const items = itemList.toArray();
        items[2].disabled = true;
        itemList.reset(items);
        itemList.notifyOnChanges();
        keyManager.setLastItemActive();
        assert.equal(keyManager.activeItemIndex, 1);
      });

      it("should setNextItemActive()", () => {
        assert.equal(keyManager.activeItemIndex, 0);
        keyManager.setNextItemActive();
        assert.equal(keyManager.activeItemIndex, 1);
      });

      it("should set the active item to the next enabled item if next is disabled", () => {
        const items = itemList.toArray();
        items[1].disabled = true;
        itemList.reset(items);
        itemList.notifyOnChanges();
        assert.equal(keyManager.activeItemIndex, 0);
        keyManager.setNextItemActive();
        assert.equal(keyManager.activeItemIndex, 2);
      });

      it("should setPreviousItemActive()", () => {
        keyManager.onKeydown(fakeKeyEvents.downArrow);
        assert.equal(keyManager.activeItemIndex, 1);
        keyManager.setPreviousItemActive();
        assert.equal(keyManager.activeItemIndex, 0);
      });

      it("should skip disabled items when setPreviousItemActive() is called", () => {
        const items = itemList.toArray();
        items[1].disabled = true;
        itemList.reset(items);
        itemList.notifyOnChanges();
        keyManager.onKeydown(fakeKeyEvents.downArrow);
        keyManager.onKeydown(fakeKeyEvents.downArrow);
        assert.equal(keyManager.activeItemIndex, 2);
        keyManager.setPreviousItemActive();
        assert.equal(keyManager.activeItemIndex, 0);
      });

      it("should not emit an event if the item did not change", () => {
        const spy = vi.fn();
        keyManager.change.subscribe(spy);
        keyManager.setActiveItem(2);
        keyManager.setActiveItem(2);
        assert.equal(spy.mock.calls.length, 1);
      });
    });

    describe("wrap mode", () => {
      it("should return itself to allow chaining", () => {
        assert.equal(keyManager.withWrap(), keyManager);
      });

      it("should wrap focus when arrow keying past items while in wrap mode", () => {
        keyManager.withWrap();
        keyManager.onKeydown(fakeKeyEvents.downArrow);
        keyManager.onKeydown(fakeKeyEvents.downArrow);
        assert.equal(keyManager.activeItemIndex, 2, "Expected last item to be active.");
        keyManager.onKeydown(fakeKeyEvents.downArrow);
        assert.equal(keyManager.activeItemIndex, 0, "Expected active item to wrap to beginning.");
        keyManager.onKeydown(fakeKeyEvents.upArrow);
        assert.equal(keyManager.activeItemIndex, 2, "Expected active item to wrap to end.");
      });

      it("should set last item active when up arrow is pressed if no active item", () => {
        keyManager.withWrap();
        keyManager.setActiveItem(-1);
        keyManager.onKeydown(fakeKeyEvents.upArrow);
        assert.equal(keyManager.activeItemIndex, 2);
        assert.ok(!calledWith(keyManager.setActiveItem, 0));
        assert.ok(calledWith(keyManager.setActiveItem, 2));
        keyManager.onKeydown(fakeKeyEvents.downArrow);
        assert.equal(keyManager.activeItemIndex, 0);
        assert.ok(calledWith(keyManager.setActiveItem, 0));
      });

      it("should not get into an infinite loop if all items are disabled", () => {
        keyManager.withWrap();
        keyManager.setActiveItem(0);
        const items = itemList.toArray();
        items.forEach((item) => (item.disabled = true));
        itemList.reset(items);
        itemList.notifyOnChanges();
        keyManager.onKeydown(fakeKeyEvents.downArrow);
        assert.equal(keyManager.activeItemIndex, 0);
      });

      it("should be able to disable wrapping", () => {
        keyManager.withWrap();
        keyManager.setFirstItemActive();
        keyManager.onKeydown(fakeKeyEvents.upArrow);
        assert.equal(keyManager.activeItemIndex, itemList.length - 1);
        keyManager.withWrap(false);
        keyManager.setFirstItemActive();
        keyManager.onKeydown(fakeKeyEvents.upArrow);
        assert.equal(keyManager.activeItemIndex, 0);
      });
    });

    describe("skip predicate", () => {
      it("should skip disabled items by default", () => {
        const items = itemList.toArray();
        items[1].disabled = true;
        itemList.reset(items);
        itemList.notifyOnChanges();
        assert.equal(keyManager.activeItemIndex, 0);
        keyManager.onKeydown(fakeKeyEvents.downArrow);
        assert.equal(keyManager.activeItemIndex, 2);
      });

      it("should be able to skip items with a custom predicate", () => {
        keyManager.skipPredicate((item) => item.skipItem);
        const items = itemList.toArray();
        items[1].skipItem = true;
        itemList.reset(items);
        itemList.notifyOnChanges();
        assert.equal(keyManager.activeItemIndex, 0);
        keyManager.onKeydown(fakeKeyEvents.downArrow);
        assert.equal(keyManager.activeItemIndex, 2);
      });
    });

    describe("typeahead mode", () => {
      const debounceInterval = 300;

      beforeEach(() => {
        keyManager.withTypeAhead(debounceInterval);
        keyManager.setActiveItem(-1);
      });

      it("should throw if the items do not implement the getLabel method", () => {
        const invalidManager = new ListKeyManager([{ disabled: false }] as ListKeyManagerOption[]);
        assert.throws(() => invalidManager.withTypeAhead(), /must implement/);
      });

      it("should debounce the input key presses", () => {
        keyManager.onKeydown(createKeyboardEvent("keydown", 79, "o"));
        keyManager.onKeydown(createKeyboardEvent("keydown", 78, "n"));
        keyManager.onKeydown(createKeyboardEvent("keydown", 69, "e"));
        assert.notEqual(keyManager.activeItem, itemList.toArray()[0]);
        wait(debounceInterval + 100);
        assert.equal(keyManager.activeItem, itemList.toArray()[0]);
      });

      it("should focus the first item that starts with a letter", () => {
        keyManager.onKeydown(createKeyboardEvent("keydown", 84, "t"));
        wait(debounceInterval + 100);
        assert.equal(keyManager.activeItem, itemList.toArray()[1]);
      });

      it("should not move focus if a modifier, that is not allowed, is pressed", () => {
        const tEvent = createKeyboardEvent("keydown", 84, "t", { control: true });
        assert.ok(!keyManager.activeItem);
        keyManager.onKeydown(tEvent);
        wait(debounceInterval + 100);
        assert.ok(!keyManager.activeItem);
      });

      it("should always allow the shift key", () => {
        const tEvent = createKeyboardEvent("keydown", 84, "t", { shift: true });
        assert.ok(!keyManager.activeItem);
        keyManager.onKeydown(tEvent);
        wait(debounceInterval + 100);
        assert.ok(keyManager.activeItem);
      });

      it("should focus the first item that starts with sequence of letters", () => {
        keyManager.onKeydown(createKeyboardEvent("keydown", 84, "t"));
        keyManager.onKeydown(createKeyboardEvent("keydown", 72, "h"));
        wait(debounceInterval + 100);
        assert.equal(keyManager.activeItem, itemList.toArray()[2]);
      });

      it("should cancel any pending timers if a navigation key is pressed", () => {
        keyManager.onKeydown(createKeyboardEvent("keydown", 84, "t"));
        keyManager.onKeydown(createKeyboardEvent("keydown", 72, "h"));
        keyManager.onKeydown(fakeKeyEvents.downArrow);
        wait(debounceInterval + 100);
        assert.equal(keyManager.activeItem, itemList.toArray()[0]);
      });

      it("should handle non-English input", () => {
        itemList.reset([new FakeFocusable("едно"), new FakeFocusable("две"), new FakeFocusable("три")]);
        itemList.notifyOnChanges();
        keyManager.onKeydown(createKeyboardEvent("keydown", 68, "д"));
        wait(debounceInterval + 100);
        assert.equal(keyManager.activeItem, itemList.toArray()[1]);
      });

      it("should handle non-letter characters", () => {
        itemList.reset([new FakeFocusable("[]"), new FakeFocusable("321"), new FakeFocusable("`!?")]);
        itemList.notifyOnChanges();
        keyManager.onKeydown(createKeyboardEvent("keydown", 192, "`"));
        wait(debounceInterval + 100);
        assert.equal(keyManager.activeItem, itemList.toArray()[2]);
        keyManager.onKeydown(createKeyboardEvent("keydown", 51, "3"));
        wait(debounceInterval + 100);
        assert.equal(keyManager.activeItem, itemList.toArray()[1]);
        keyManager.onKeydown(createKeyboardEvent("keydown", 219, "["));
        wait(debounceInterval + 100);
        assert.equal(keyManager.activeItem, itemList.toArray()[0]);
      });

      it("should not focus disabled items", () => {
        assert.ok(!keyManager.activeItem);
        const items = itemList.toArray();
        items[0].disabled = true;
        itemList.reset(items);
        itemList.notifyOnChanges();
        keyManager.onKeydown(createKeyboardEvent("keydown", 79, "o"));
        wait(debounceInterval + 100);
        assert.ok(!keyManager.activeItem);
      });

      const fellowship = () => [new FakeFocusable("Bilbo"), new FakeFocusable("Frodo"), new FakeFocusable("Pippin"), new FakeFocusable("Boromir"), new FakeFocusable("Aragorn")];

      it("should start looking for matches after the active item", () => {
        itemList.reset(fellowship());
        itemList.notifyOnChanges();
        keyManager.setActiveItem(1);
        keyManager.onKeydown(createKeyboardEvent("keydown", 66, "b"));
        wait(debounceInterval + 100);
        assert.equal(keyManager.activeItem, itemList.toArray()[3]);
      });

      it("should wrap back around if there were no matches after the active item", () => {
        itemList.reset(fellowship());
        itemList.notifyOnChanges();
        keyManager.setActiveItem(3);
        keyManager.onKeydown(createKeyboardEvent("keydown", 66, "b"));
        wait(debounceInterval + 100);
        assert.equal(keyManager.activeItem, itemList.toArray()[0]);
      });

      it("should wrap back around if the last item is active", () => {
        keyManager.setActiveItem(2);
        keyManager.onKeydown(createKeyboardEvent("keydown", 79, "o"));
        wait(debounceInterval + 100);
        assert.equal(keyManager.activeItem, itemList.toArray()[0]);
      });

      it("should be able to select the first item", () => {
        keyManager.setActiveItem(-1);
        keyManager.onKeydown(createKeyboardEvent("keydown", 79, "o"));
        wait(debounceInterval + 100);
        assert.equal(keyManager.activeItem, itemList.toArray()[0]);
      });

      it("should not do anything if there is no match", () => {
        keyManager.setActiveItem(1);
        keyManager.onKeydown(createKeyboardEvent("keydown", 87, "w"));
        wait(debounceInterval + 100);
        assert.equal(keyManager.activeItem, itemList.toArray()[1]);
      });

      it("should expose whether the user is currently typing", () => {
        assert.equal(keyManager.isTyping(), false);
        keyManager.onKeydown(createKeyboardEvent("keydown", 79, "o"));
        assert.equal(keyManager.isTyping(), true);
        wait(debounceInterval + 100);
        assert.equal(keyManager.isTyping(), false);
      });

      it("should reset isTyping if the key manager is destroyed", () => {
        assert.equal(keyManager.isTyping(), false);
        keyManager.onKeydown(createKeyboardEvent("keydown", 79, "o"));
        assert.equal(keyManager.isTyping(), true);
        keyManager.destroy();
        assert.equal(keyManager.isTyping(), false);
      });

      it("should be able to cancel the typeahead sequence", () => {
        assert.ok(!keyManager.activeItem);
        keyManager.onKeydown(createKeyboardEvent("keydown", 79, "o"));
        assert.ok(!keyManager.activeItem);
        keyManager.cancelTypeahead();
        wait(debounceInterval + 100);
        assert.ok(!keyManager.activeItem);
      });
    });
  });

  describe("FocusKeyManager", () => {
    let keyManager: FocusKeyManager<FakeFocusable>;
    let focus: ReturnType<typeof vi.fn>[];

    beforeEach(() => {
      itemList.reset([new FakeFocusable(), new FakeFocusable(), new FakeFocusable()]);
      itemList.notifyOnChanges();
      keyManager = new FocusKeyManager<FakeFocusable>(itemList.items);
      // first item is already focused
      keyManager.setFirstItemActive();
      focus = itemList.toArray().map((item: FakeFocusable) => vi.spyOn(item, "focus"));
    });

    afterEach(() => {
      keyManager.destroy();
      keyManager = null!;
    });

    it("should focus subsequent items when down arrow is pressed", () => {
      keyManager.onKeydown(fakeKeyEvents.downArrow);
      assert.equal(focus[0]!.mock.calls.length, 0);
      assert.equal(focus[1]!.mock.calls.length, 1);
      assert.equal(focus[2]!.mock.calls.length, 0);
      keyManager.onKeydown(fakeKeyEvents.downArrow);
      assert.equal(focus[0]!.mock.calls.length, 0);
      assert.equal(focus[1]!.mock.calls.length, 1);
      assert.equal(focus[2]!.mock.calls.length, 1);
    });

    it("should focus previous items when up arrow is pressed", () => {
      keyManager.onKeydown(fakeKeyEvents.downArrow);
      assert.equal(focus[0]!.mock.calls.length, 0);
      assert.equal(focus[1]!.mock.calls.length, 1);
      keyManager.onKeydown(fakeKeyEvents.upArrow);
      assert.equal(focus[0]!.mock.calls.length, 1);
      assert.equal(focus[1]!.mock.calls.length, 1);
    });

    it("should allow setting the focused item without calling focus", () => {
      assert.equal(keyManager.activeItemIndex, 0);
      keyManager.updateActiveItem(1);
      assert.equal(keyManager.activeItemIndex, 1);
      assert.equal(focus[1]!.mock.calls.length, 0);
    });

    it("should be able to set the focus origin", () => {
      keyManager.setFocusOrigin("mouse");
      keyManager.onKeydown(fakeKeyEvents.downArrow);
      assert.ok(calledWith(focus[1], "mouse"));
      keyManager.onKeydown(fakeKeyEvents.downArrow);
      assert.ok(calledWith(focus[2], "mouse"));
      keyManager.setFocusOrigin("keyboard");
      keyManager.onKeydown(fakeKeyEvents.upArrow);
      assert.ok(calledWith(focus[1], "keyboard"));
    });
  });

  describe("ActiveDescendantKeyManager", () => {
    let keyManager: ActiveDescendantKeyManager<FakeHighlightable>;
    let active: ReturnType<typeof vi.fn>[];
    let inactive: ReturnType<typeof vi.fn>[];

    beforeEach(() => {
      itemList.reset([new FakeHighlightable(), new FakeHighlightable(), new FakeHighlightable()]);
      itemList.notifyOnChanges();
      keyManager = new ActiveDescendantKeyManager<FakeHighlightable>(itemList.items);
      // first item is already focused
      keyManager.setFirstItemActive();
      active = itemList.toArray().map((item: FakeHighlightable) => vi.spyOn(item, "setActiveStyles"));
      inactive = itemList.toArray().map((item: FakeHighlightable) => vi.spyOn(item, "setInactiveStyles"));
    });

    it("should set subsequent items as active with the DOWN arrow", () => {
      keyManager.onKeydown(fakeKeyEvents.downArrow);
      assert.ok(active[1]!.mock.calls.length > 0);
      assert.equal(active[2]!.mock.calls.length, 0);
      keyManager.onKeydown(fakeKeyEvents.downArrow);
      assert.ok(active[2]!.mock.calls.length > 0);
    });

    it("should set previous items as active with the UP arrow", () => {
      keyManager.setLastItemActive();
      keyManager.onKeydown(fakeKeyEvents.upArrow);
      assert.ok(active[1]!.mock.calls.length > 0);
      assert.equal(active[0]!.mock.calls.length, 0);
      keyManager.onKeydown(fakeKeyEvents.upArrow);
      assert.ok(active[0]!.mock.calls.length > 0);
    });

    it("should set inactive styles on previously active items", () => {
      keyManager.onKeydown(fakeKeyEvents.downArrow);
      assert.ok(inactive[0]!.mock.calls.length > 0);
      keyManager.onKeydown(fakeKeyEvents.upArrow);
      assert.ok(inactive[1]!.mock.calls.length > 0);
    });
  });
});
