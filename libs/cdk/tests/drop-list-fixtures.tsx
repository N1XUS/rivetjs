// Ported from Angular Components (src/cdk/drag-drop/directives/drop-list-shared.spec.ts — the fixtures
// and helpers after `defineCommonDropListTests`), MIT, © Google LLC.
// Changes:
// - every `@Component` is a `DropListFixture` (a `TestComponent`, drag-test-utils.tsx) with the upstream
//   name and fields; `template()` is the Angular template as Rivet TSX (subclasses with a different
//   upstream template override `template()`), `styles` the component styles (a `<style>` rendered with
//   the view: global while the fixture lives, like `ViewEncapsulation.None`), `encapsulation =
//   "shadow-dom"` renders the view into a shadow root of `host` (Angular `ViewEncapsulation.ShadowDom`
//   / the `encapsulation` option of `createComponent`; set it before the first `detectChanges()`).
// - Change detection: fields the template reads are accessors that re-render when assigned
//   (`fixture.componentInstance.items = [...]`); in-place mutations (`items.push(...)`,
//   `items[0].height = ...`) re-render on `markForCheck()` (Angular `changeDetectorRef.markForCheck()`
//   + `detectChanges()`), which also creates the directive instances of new elements right away, like
//   Angular does on view creation (Rivet otherwise creates them on first use). Inputs Angular reads when a
//   drag starts (`boundarySelector`, `previewClass`, `previewContainer`, `scale`, `item.lockAxis`) are
//   closures over plain fields; `constrainPosition` is read when the view renders.
// - `@ViewChildren(CdkDrag)` → `QueryList` of `DragInstance`s in view order (a dragged item counts at
//   its original place); `@ViewChildren(CdkDropList)` → `QueryList` of `DropListInstance`s;
//   `@ViewChild(CdkDropList)` → `DropListInstance`; `@ViewChild('ref')` → `{ nativeElement }`. Instances
//   expose `.element` as the `HTMLElement` (Angular: `element.nativeElement`). QueryLists are live
//   (re-query on every read). `#ref` template variables → DOM lookups in the view (JSX yields ranges,
//   not elements); `[style.x.px]` on a `<Drag>` → initial `style` + a `<template>` child that re-applies
//   it on `markForCheck()`.
// - `ngAfterViewInit` scroll resets (Firefox-only workaround) are dropped; `ConnectedDropZones`'
//   `groupedDragItems` is computed on first access (after the first render, like `ngAfterViewInit`);
//   `DraggableWithCanvasInDropZone` draws its circles when a canvas is created.
// - `cdkScrollable` → a `CdkScrollable` (scrolling/scrollable.ts) over the element; `ng-container` /
//   `ng-template` / `*ngIf` wrappers → `Show` / plain nesting; `DropListOnNgContainer` creates a
//   `DropListInstance` on a comment node (Rivet `<DropList>` always renders an element).
// - `assertStartToEndSorting` / `assertEndToStartSorting`: `markForCheck()` dropped (nothing changed),
//   `fixture.whenStable()` → `wait(0)`.
import { effect, onCleanup, signal, untrack } from "@rivetjs/reactivity";
import { For, Portal, Show, ref, type DOMValue } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { expect, jasmine } from "@rivetjs/testing/jasmine";
import { dispatchMouseEvent } from "@rivetjs/testing/fake-events";
import {
  Drag,
  DragPlaceholder,
  type DragProps,
  type DropListProps,
  DragPreview,
  DropList,
  DropListGroup,
  DropListInstance,
  dragInstance,
  dropListInstance,
  moveItemInArray,
  type DragAxis,
  type DragDrop,
  type DragInstance,
  type DropListOrientation,
  type Point,
  type PreviewContainer,
} from "../drag-drop/index.tsx";
import { groupOf, type DropListGroupInstance } from "../drag-drop/directives/drop-list-group.ts";
import { drags } from "../drag-drop/directives/registry.ts";
import { CdkScrollable } from "../scrolling/scrollable.ts";
import { TestComponent, startDraggingViaMouse, wait, type ComponentFixture } from "./drag-test-utils.tsx";
import type { SortedSiblingsFunction } from "./drop-list-shared.tsx";

/** A DOM node (or view) rendered inside JSX. */
const content = (value: DOMValue) => value as unknown as Content;

export const ITEM_HEIGHT = 25;
export const ITEM_WIDTH = 75;

/** Angular `ElementRef`. */
export interface ElementRef<E extends Element = HTMLElement> {
  nativeElement: E;
}

/**
 * Angular `QueryList` (the parts the specs use): live — every read re-queries the view, so a list kept
 * across a re-render reflects it (Angular updates the same `QueryList` on change detection).
 */
export class QueryList<T> implements Iterable<T> {
  private readonly _query: () => T[];
  constructor(query: () => T[]) {
    this._query = query;
  }
  get length(): number {
    return this._query().length;
  }
  get first(): T {
    return this._query()[0];
  }
  get last(): T {
    const items = this._query();
    return items[items.length - 1];
  }
  get(index: number): T | undefined {
    return this._query()[index];
  }
  toArray(): T[] {
    return this._query().slice();
  }
  map<U>(fn: (item: T, index: number, array: T[]) => U): U[] {
    return this._query().map(fn);
  }
  forEach(fn: (item: T, index: number, array: T[]) => void): void {
    this._query().forEach(fn);
  }
  filter(fn: (item: T, index: number, array: T[]) => unknown): T[] {
    return this._query().filter(fn);
  }
  find(fn: (item: T, index: number, array: T[]) => unknown): T | undefined {
    return this._query().find(fn);
  }
  some(fn: (item: T, index: number, array: T[]) => unknown): boolean {
    return this._query().some(fn);
  }
  reduce<U>(fn: (previous: U, item: T, index: number, array: T[]) => U, initial: U): U {
    return this._query().reduce(fn, initial);
  }
  [Symbol.iterator](): Iterator<T> {
    return this._query()[Symbol.iterator]();
  }
}

/** Elements the engine adds while dragging (not part of the view). */
const DRAG_ARTIFACTS = ".cdk-drag-preview, .cdk-drag-placeholder, .cdk-drag-anchor";

/** The element (moved to the end of the body while dragging) whose drag ref left `marker` at its place. */
function draggedElementOf(marker: Comment): Element | null {
  for (const child of Array.from(marker.ownerDocument.body.children)) {
    if (child.matches(DRAG_ARTIFACTS)) continue;
    const candidates = [child, ...Array.from(child.querySelectorAll("[data-rv-drag]"))];
    if (candidates.some((element) => (drags.get(element)?._dragRef as unknown as { _marker?: Comment } | undefined)?._marker === marker)) return child;
  }
  return null;
}

/** `@ViewChildren(CdkDrag)`: the `<Drag>` instances below `root` in view order. */
export function viewDrags(root: ParentNode): QueryList<DragInstance> {
  return new QueryList(() => queryDrags(root));
}

function queryDrags(root: ParentNode): DragInstance[] {
  const out: DragInstance[] = [];
  const add = (element: Element) => {
    const instance = dragInstance(element);
    if (instance && !out.includes(instance)) out.push(instance);
  };
  const visit = (scope: Node) => {
    if (scope.nodeType === 1 && (scope as Element).hasAttribute("data-rv-drag")) add(scope as Element);
    const walker = (scope.ownerDocument ?? document).createTreeWalker(scope, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT, {
      acceptNode: (node) => (node.nodeType === 1 && (node as Element).matches(DRAG_ARTIFACTS) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === 8) {
        if ((node as Comment).data === "cdk-drag-marker") {
          const dragged = draggedElementOf(node as Comment);
          if (dragged) visit(dragged);
        }
      } else if ((node as Element).hasAttribute("data-rv-drag")) add(node as Element);
    }
  };
  visit(root as unknown as Node);
  return out;
}

/** `@ViewChildren(CdkDropList)`: the `<DropList>` instances below `root` in DOM order. */
export function viewDropLists(root: ParentNode): QueryList<DropListInstance> {
  return new QueryList(() =>
    Array.from(root.querySelectorAll("[data-rv-drop-list]"))
      .filter((element) => !element.closest(DRAG_ARTIFACTS))
      .map((element) => dropListInstance(element)!),
  );
}

function styleElement(css: string): HTMLStyleElement {
  const element = document.createElement("style");
  element.textContent = css;
  return element;
}

type Styles = () => Record<string, string | undefined>;

/**
 * `[style.x.px]` bindings of a component's root element (Drag renders its `style` prop once): a
 * `<template>` child finds the element (JSX yields a range, not the element) and re-applies the
 * styles on every change detection pass.
 */
function styleBinding(styles: Styles): Content {
  const probe = ref<HTMLTemplateElement>();
  effect(() => {
    const values = styles();
    const element = probe()?.parentElement;
    if (element) for (const name in values) element.style.setProperty(name, values[name] ?? null);
  });
  return <template ref={probe}></template>;
}

/** `<Drag>` with props built in code, plus optional `[style.x.px]` bindings (`styles`). */
function DragElement(props: DragProps, styles?: Styles): Content {
  if (!styles) return untrack(() => Drag(props)) as unknown as Content;
  const children = content([props.children as DOMValue, styleBinding(styles) as unknown as DOMValue]);
  return untrack(() => Drag({ ...props, style: { ...props.style, ...untrack(styles) }, children })) as unknown as Content;
}
/** `<DropList>` with props built in code. */
const DropListElement = (props: DropListProps) => untrack(() => DropList(props)) as unknown as Content;

const px = (value: number | undefined) => (value == null ? undefined : `${value}px`);

/** Base of the drop-list fixtures (Angular `@Component` + its change detection). */
export abstract class DropListFixture extends TestComponent {
  /** Change detection pass: bindings that read template state track it. */
  private readonly _tick = signal(0);
  /** Angular `ViewEncapsulation` (`createComponent(..., {encapsulation})`); set before the first render. */
  encapsulation: "emulated" | "none" | "shadow-dom" = "emulated";
  /** Component styles. */
  styles = "";

  /** The Angular template. */
  abstract template(): DOMValue;

  /** Where the view renders: the host, or its shadow root. */
  get root(): ParentNode {
    return this.host.shadowRoot ?? this.host;
  }

  override query<E extends Element = HTMLElement>(selector: string): E {
    return this.root.querySelector<E>(selector)!;
  }

  override queryAll<E extends Element = HTMLElement>(selector: string): E[] {
    return Array.from(this.root.querySelectorAll<E>(selector));
  }

  view(): DOMValue {
    const content = [this.styles ? styleElement(this.styles) : null, this.template()];
    if (this.encapsulation === "shadow-dom") {
      const shadowRoot = this.host.shadowRoot ?? this.host.attachShadow({ mode: "open" });
      return <Portal mount={shadowRoot as unknown as Element}>{content}</Portal>;
    }
    return content;
  }

  /** Track the change detection pass (call in bindings that read mutable template state). */
  protected tracked(): void {
    this._tick();
  }

  /**
   * Angular `changeDetectorRef.markForCheck()` + `detectChanges()`: re-render, then create the
   * directive instances of the elements that appeared (Angular creates them with their view).
   */
  markForCheck(): void {
    this._tick.set(this._tick() + 1);
    if (!this.host) return;
    const root = this.root;
    root.querySelectorAll("[data-rv-drop-list]").forEach((element) => {
      if (!element.closest(DRAG_ARTIFACTS)) dropListInstance(element);
    });
    root.querySelectorAll("[data-rv-drag]").forEach((element) => {
      if (!element.closest(DRAG_ARTIFACTS)) dragInstance(element);
    });
  }
}

export async function assertStartToEndSorting(
  listOrientation: "vertical" | "horizontal",
  fixture: ComponentFixture<any>,
  getSortedSiblings: SortedSiblingsFunction,
  items: Element[],
) {
  const draggedItem = items[0];
  const { top, left } = draggedItem.getBoundingClientRect();

  startDraggingViaMouse(fixture, draggedItem, left, top);

  const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;

  // Drag over each item one-by-one going downwards.
  for (let i = 0; i < items.length; i++) {
    const elementRect = items[i].getBoundingClientRect();

    // Add a few pixels to the top offset so we get some overlap.
    if (listOrientation === "vertical") {
      dispatchMouseEvent(document, "mousemove", elementRect.left, elementRect.top + 5);
    } else {
      dispatchMouseEvent(document, "mousemove", elementRect.left + 5, elementRect.top);
    }

    fixture.detectChanges();

    const sortedSiblings = getSortedSiblings(placeholder, listOrientation === "vertical" ? "top" : "left");
    expect(sortedSiblings.indexOf(placeholder)).toBe(i);
  }

  dispatchMouseEvent(document, "mouseup");
  fixture.detectChanges();
  await wait(0);
}

export async function assertEndToStartSorting(
  listOrientation: "vertical" | "horizontal",
  fixture: ComponentFixture<any>,
  getSortedSiblings: SortedSiblingsFunction,
  items: Element[],
) {
  const draggedItem = items[items.length - 1];
  const { top, left } = draggedItem.getBoundingClientRect();

  startDraggingViaMouse(fixture, draggedItem, left, top);

  const placeholder = document.querySelector(".cdk-drag-placeholder")! as HTMLElement;

  // Drag over each item one-by-one going upwards.
  for (let i = items.length - 1; i > -1; i--) {
    const elementRect = items[i].getBoundingClientRect();

    // Remove a few pixels from the bottom offset so we get some overlap.
    if (listOrientation === "vertical") {
      dispatchMouseEvent(document, "mousemove", elementRect.left, elementRect.bottom - 5);
    } else {
      dispatchMouseEvent(document, "mousemove", elementRect.right - 5, elementRect.top);
    }

    fixture.detectChanges();
    expect(getSortedSiblings(placeholder, listOrientation === "vertical" ? "top" : "left").indexOf(placeholder)).toBe(i);
  }

  dispatchMouseEvent(document, "mouseup");
  fixture.detectChanges();
  await wait(0);
}

interface HorizontalItem {
  value: string;
  width: number;
  margin: number;
}

/**
 * Dynamically creates the horizontal list fixtures. They need to be
 * generated so that the list orientation can be changed between tests.
 * @param listOrientation Orientation value to be assigned to the list.
 *    Does not affect the actual styles.
 */
export function getHorizontalFixtures(listOrientation: Exclude<DropListOrientation, "vertical">) {
  // Use inline blocks here to avoid flexbox issues and not to have to flip floats in rtl.
  const HORIZONTAL_FIXTURE_STYLES = `
    .cdk-drop-list {
      display: block;
      width: 500px;
      background: pink;
      font-size: 0;
    }

    .cdk-drag {
      height: ${ITEM_HEIGHT * 2}px;
      background: red;
      display: inline-block;
    }
  `;

  class DraggableInHorizontalDropZone extends DropListFixture {
    readonly _listOrientation = listOrientation;
    override styles = HORIZONTAL_FIXTURE_STYLES;

    get dragItems(): QueryList<DragInstance> {
      return viewDrags(this.root);
    }
    get dropInstance(): DropListInstance {
      return dropListInstance(this.query(".cdk-drop-list"))!;
    }
    private _items: HorizontalItem[] = [
      { value: "Zero", width: ITEM_WIDTH, margin: 0 },
      { value: "One", width: ITEM_WIDTH, margin: 0 },
      { value: "Two", width: ITEM_WIDTH, margin: 0 },
      { value: "Three", width: ITEM_WIDTH, margin: 0 },
    ];
    get items(): HorizontalItem[] {
      this.tracked();
      return this._items;
    }
    set items(value: HorizontalItem[]) {
      this._items = value;
      this.markForCheck();
    }
    boundarySelector!: string;
    droppedSpy = jasmine.createSpy("dropped spy").and.callFake((event: DragDrop<string[]>) => {
      moveItemInArray(this.items, event.previousIndex, event.currentIndex);
      this.markForCheck();
    });

    template(): DOMValue {
      return (
        <DropList class="drop-list scroll-container" orientation={this._listOrientation} data={() => this.items} onDropped={(event) => this.droppedSpy(event)}>
          <For each={() => this.items} by={(item) => item}>
            {(item) => {
              return DragElement(
                { boundaryElement: () => this.boundarySelector, children: content(<>{item().value}</>) },
                () => (this.tracked(), { width: px(item().width), "margin-right": px(item().margin) }),
              );
            }}
          </For>
        </DropList>
      );
    }
  }

  class DraggableInScrollableHorizontalDropZone extends DraggableInHorizontalDropZone {
    // Note that it needs a margin to ensure that it's not flush against the viewport
    // edge which will cause the viewport to scroll, rather than the list.
    override styles =
      HORIZONTAL_FIXTURE_STYLES +
      `
        .drop-list {
          max-width: 300px;
          margin: 10vw 0 0 10vw;
          overflow: auto;
          white-space: nowrap;
        }
      `;

    constructor() {
      super();

      for (let i = 0; i < 60; i++) {
        this.items.push({ value: `Extra item ${i}`, width: ITEM_WIDTH, margin: 0 });
      }
    }
  }

  class DraggableInHorizontalFlexDropZoneWithMatchSizePreview extends DropListFixture {
    readonly _listOrientation = listOrientation;
    override styles = `
      .list {
        display: flex;
        width: 100px;
        flex-direction: row;
      }

      .item {
        display: flex;
        flex-grow: 1;
        flex-basis: 0;
        min-height: 50px;
      }
    `;

    get dragItems(): QueryList<DragInstance> {
      return viewDrags(this.root);
    }
    items = ["Zero", "One", "Two"];

    template(): DOMValue {
      return (
        <DropList class="list" orientation={this._listOrientation}>
          <For each={() => this.items} by={(item) => item}>
            {(item) => (
              <Drag class="item">
                {item()}
                <DragPreview matchSize={true}>
                  <div class="item">{item()}</div>
                </DragPreview>
              </Drag>
            )}
          </For>
        </DropList>
      );
    }
  }

  return {
    DraggableInHorizontalDropZone,
    DraggableInScrollableHorizontalDropZone,
    DraggableInHorizontalFlexDropZoneWithMatchSizePreview,
  };
}

interface VerticalItem {
  value: string;
  height: number;
  margin: number;
}

export class DraggableInDropZone extends DropListFixture {
  get dragItems(): QueryList<DragInstance> {
    return viewDrags(this.root);
  }
  get dropInstance(): DropListInstance {
    return dropListInstance(this.query(".cdk-drop-list"))!;
  }
  get alternatePreviewContainer(): ElementRef {
    return { nativeElement: this.query('[data-ref="alternatePreviewContainer"]') };
  }
  private _items: VerticalItem[] = [
    { value: "Zero", height: ITEM_HEIGHT, margin: 0 },
    { value: "One", height: ITEM_HEIGHT, margin: 0 },
    { value: "Two", height: ITEM_HEIGHT, margin: 0 },
    { value: "Three", height: ITEM_HEIGHT, margin: 0 },
  ];
  get items(): VerticalItem[] {
    this.tracked();
    return this._items;
  }
  set items(value: VerticalItem[]) {
    this._items = value;
    this.markForCheck();
  }
  dropZoneId = "items";
  boundarySelector!: string;
  previewClass: string | string[] = [];
  sortedSpy = jasmine.createSpy("sorted spy");
  droppedSpy = jasmine.createSpy("dropped spy").and.callFake((event: DragDrop<string[]>) => {
    moveItemInArray(this.items, event.previousIndex, event.currentIndex);
    this.markForCheck();
  });
  startedSpy = jasmine.createSpy("started spy");
  previewContainer: PreviewContainer = "global";
  dropDisabled = signal(false);
  dropLockAxis = signal<DragAxis | null>(null);
  scale = 1;

  /** `DROP_ZONE_FIXTURE_TEMPLATE`. */
  dropZoneTemplate(): DOMValue {
    return [
      <DropList
        class="drop-list scroll-container"
        style={{ width: "100px", background: "pink" }}
        id={this.dropZoneId}
        data={() => this.items}
        disabled={this.dropDisabled}
        lockAxis={this.dropLockAxis}
        onSorted={(event) => this.sortedSpy(event)}
        onDropped={(event) => this.droppedSpy(event)}
      >
        <For each={() => this.items} by={(item) => item}>
          {(item) => {
            return DragElement(
              {
                data: item,
                boundaryElement: () => this.boundarySelector,
                previewClass: () => this.previewClass,
                previewContainer: () => this.previewContainer,
                scale: () => this.scale,
                onStarted: (event) => this.startedSpy(event),
                style: { width: "100%", background: "red" },
                children: content(<>{item().value}</>),
              },
              () => (this.tracked(), { height: px(item().height), "margin-bottom": px(item().margin) }),
            );
          }}
        </For>
      </DropList>,
      <div data-ref="alternatePreviewContainer"></div>,
    ];
  }

  template(): DOMValue {
    return this.dropZoneTemplate();
  }
}

export class DraggableInOnPushDropZone extends DraggableInDropZone {}

export class ConnectedDropListsInOnPush extends DropListFixture {
  readonly zones = [new DraggableInOnPushDropZone(), new DraggableInOnPushDropZone()];

  template(): DOMValue {
    for (const zone of this.zones) zone.host = this.host;
    return <DropListGroup>{content(this.zones.map((zone) => zone.template()))}</DropListGroup>;
  }
}

export class DraggableInScrollableVerticalDropZone extends DraggableInDropZone {
  // Note that it needs a margin to ensure that it's not flush against the viewport
  // edge which will cause the viewport to scroll, rather than the list.
  override styles = `
    .drop-list {
      max-height: 200px;
      overflow: auto;
      margin: 10vw 0 0 10vw;
    }
  `;

  constructor() {
    super();

    for (let i = 0; i < 60; i++) {
      this.items.push({ value: `Extra item ${i}`, height: ITEM_HEIGHT, margin: 0 });
    }
  }
}

export class DraggableInScrollableParentContainer extends DraggableInDropZone {
  get scrollContainer(): ElementRef {
    return { nativeElement: this.query('[data-ref="scrollContainer"]') };
  }

  // Note that it needs a margin to ensure that it's not flush against the viewport
  // edge which will cause the viewport to scroll, rather than the list.
  override styles = `
    .scroll-container {
      max-height: 200px;
      overflow: auto;
      margin: 10vw 0 0 10vw;
    }
  `;

  constructor() {
    super();

    for (let i = 0; i < 60; i++) {
      this.items.push({ value: `Extra item ${i}`, height: ITEM_HEIGHT, margin: 0 });
    }
  }

  override template(): DOMValue {
    // `cdkScrollable`
    const scrollable = (element: HTMLElement) => {
      const instance = new CdkScrollable(element).init();
      onCleanup(() => instance.destroy());
    };
    return (
      <div ref={scrollable} data-ref="scrollContainer" class="scroll-container">
        {content(this.dropZoneTemplate())}
      </div>
    );
  }
}

export class DraggableInDropZoneWithContainer extends DraggableInDropZone {
  // Note that we need the blank `Show` below to hit the code path that we're testing.
  override template(): DOMValue {
    return (
      <DropList
        class="drop-list scroll-container"
        style={{ width: "100px", background: "pink" }}
        id={this.dropZoneId}
        data={() => this.items}
        onSorted={(event) => this.sortedSpy(event)}
        onDropped={(event) => this.droppedSpy(event)}
      >
        <Show when={() => true}>
          {() => (
            <For each={() => this.items} by={(item) => item}>
              {(item) => {
                return DragElement(
                  {
                    data: item,
                    boundaryElement: () => this.boundarySelector,
                    style: { width: "100%", background: "red" },
                    children: content(<>{item().value}</>),
                  },
                  () => (this.tracked(), { height: px(item().height), "margin-bottom": px(item().margin) }),
                );
              }}
            </For>
          )}
        </Show>
      </DropList>
    );
  }
}

interface PreviewItem {
  label: string;
  lockAxis: DragAxis | null;
}

export class DraggableInDropZoneWithCustomPreview extends DropListFixture {
  get dropInstance(): DropListInstance {
    return dropListInstance(this.query(".cdk-drop-list"))!;
  }
  get dragItems(): QueryList<DragInstance> {
    return viewDrags(this.root);
  }
  private _items: PreviewItem[] = [
    { label: "Zero", lockAxis: null },
    { label: "One", lockAxis: null },
    { label: "Two", lockAxis: null },
    { label: "Three", lockAxis: null },
  ];
  get items(): PreviewItem[] {
    this.tracked();
    return this._items;
  }
  set items(value: PreviewItem[]) {
    this._items = value;
    this.markForCheck();
  }
  boundarySelector!: string;
  private _renderCustomPreview = true;
  get renderCustomPreview(): boolean {
    this.tracked();
    return this._renderCustomPreview;
  }
  set renderCustomPreview(value: boolean) {
    this._renderCustomPreview = value;
    this.markForCheck();
  }
  matchPreviewSize = false;
  previewClass: string | string[] = [];
  constrainPosition: ((point: Point) => Point) | undefined;
  dropLockAxis = signal<DragAxis | null>(null);

  template(): DOMValue {
    const constrainPosition = this.constrainPosition;
    return (
      <DropList style={{ width: "100px", background: "pink" }} lockAxis={this.dropLockAxis}>
        <For each={() => this.items} by={(item) => item}>
          {(item) => (
            <Drag
              constrainPosition={constrainPosition}
              boundaryElement={() => this.boundarySelector}
              previewClass={() => this.previewClass}
              lockAxis={() => item().lockAxis}
              style={{ width: "100%", height: `${ITEM_HEIGHT}px`, background: "red" }}
            >
              {item().label}
              <Show when={() => this.renderCustomPreview}>
                {() => (
                  <DragPreview matchSize={this.matchPreviewSize}>
                    <div class="custom-preview" style={{ width: "50px", height: "50px", background: "purple" }}>
                      Custom preview
                    </div>
                  </DragPreview>
                )}
              </Show>
            </Drag>
          )}
        </For>
      </DropList>
    );
  }
}

export class DraggableInDropZoneWithCustomTextOnlyPreview extends DropListFixture {
  get dropInstance(): DropListInstance {
    return dropListInstance(this.query(".cdk-drop-list"))!;
  }
  get dragItems(): QueryList<DragInstance> {
    return viewDrags(this.root);
  }
  items = ["Zero", "One", "Two", "Three"];

  template(): DOMValue {
    return (
      <DropList style={{ width: "100px", background: "pink" }}>
        <For each={() => this.items} by={(item) => item}>
          {(item) => (
            <Drag style={{ width: "100%", height: `${ITEM_HEIGHT}px`, background: "red" }}>
              {item()}
              <DragPreview>Hello {item()}</DragPreview>
            </Drag>
          )}
        </For>
      </DropList>
    );
  }
}

export class DraggableInDropZoneWithCustomMultiNodePreview extends DropListFixture {
  get dropInstance(): DropListInstance {
    return dropListInstance(this.query(".cdk-drop-list"))!;
  }
  get dragItems(): QueryList<DragInstance> {
    return viewDrags(this.root);
  }
  items = ["Zero", "One", "Two", "Three"];

  template(): DOMValue {
    return (
      <DropList style={{ width: "100px", background: "pink" }}>
        <For each={() => this.items} by={(item) => item}>
          {(item) => (
            <Drag style={{ width: "100%", height: `${ITEM_HEIGHT}px`, background: "red" }}>
              {item()}
              <DragPreview>
                <span>Hello</span>
                <span>{item()}</span>
              </DragPreview>
            </Drag>
          )}
        </For>
      </DropList>
    );
  }
}

export class DraggableInDropZoneWithCustomPlaceholder extends DropListFixture {
  override styles = `
    .tall-placeholder {
      height: ${ITEM_HEIGHT * 3}px;
    }
  `;
  get dragItems(): QueryList<DragInstance> {
    return viewDrags(this.root);
  }
  items = ["Zero", "One", "Two", "Three"];
  private _renderPlaceholder = true;
  get renderPlaceholder(): boolean {
    this.tracked();
    return this._renderPlaceholder;
  }
  set renderPlaceholder(value: boolean) {
    this._renderPlaceholder = value;
    this.markForCheck();
  }
  private _extraPlaceholderClass = "";
  get extraPlaceholderClass(): string {
    this.tracked();
    return this._extraPlaceholderClass;
  }
  set extraPlaceholderClass(value: string) {
    this._extraPlaceholderClass = value;
    this.markForCheck();
  }
  droppedSpy = jasmine.createSpy("dropped spy");

  template(): DOMValue {
    return (
      <DropList onDropped={(event) => this.droppedSpy(event)} style={{ width: "100px", background: "pink" }}>
        <For each={() => this.items} by={(item) => item}>
          {(item) => (
            <Drag style={{ width: "100%", height: `${ITEM_HEIGHT}px`, background: "red" }}>
              {item()}
              <Show when={() => this.renderPlaceholder}>
                {() => (
                  <DragPlaceholder>
                    <div class={["custom-placeholder", this.extraPlaceholderClass]}>Custom placeholder</div>
                  </DragPlaceholder>
                )}
              </Show>
            </Drag>
          )}
        </For>
      </DropList>
    );
  }
}

export class DraggableInDropZoneWithCustomTextOnlyPlaceholder extends DropListFixture {
  get dragItems(): QueryList<DragInstance> {
    return viewDrags(this.root);
  }
  items = ["Zero", "One", "Two", "Three"];

  template(): DOMValue {
    return (
      <DropList style={{ width: "100px", background: "pink" }}>
        <For each={() => this.items} by={(item) => item}>
          {(item) => (
            <Drag style={{ width: "100%", height: `${ITEM_HEIGHT}px`, background: "red" }}>
              {item()}
              <DragPlaceholder>Hello {item()}</DragPlaceholder>
            </Drag>
          )}
        </For>
      </DropList>
    );
  }
}

export class DraggableInDropZoneWithCustomMultiNodePlaceholder extends DropListFixture {
  get dragItems(): QueryList<DragInstance> {
    return viewDrags(this.root);
  }
  items = ["Zero", "One", "Two", "Three"];

  template(): DOMValue {
    return (
      <DropList style={{ width: "100px", background: "pink" }}>
        <For each={() => this.items} by={(item) => item}>
          {(item) => (
            <Drag style={{ width: "100%", height: `${ITEM_HEIGHT}px`, background: "red" }}>
              {item()}
              <DragPlaceholder>
                <span>Hello</span>
                <span>{item()}</span>
              </DragPlaceholder>
            </Drag>
          )}
        </For>
      </DropList>
    );
  }
}

const CONNECTED_DROP_ZONES_STYLES = `
  .cdk-drop-list {
    display: block;
    width: 100px;
    min-height: ${ITEM_HEIGHT}px;
    background: hotpink;
  }

  .cdk-drag {
    display: block;
    height: ${ITEM_HEIGHT}px;
    background: red;
  }
`;

type ConnectedTo = (DropListInstance | string)[] | undefined;

export class ConnectedDropZones extends DropListFixture {
  override encapsulation: DropListFixture["encapsulation"] = "none";
  override styles = CONNECTED_DROP_ZONES_STYLES;

  get rawDragItems(): QueryList<DragInstance> {
    return viewDrags(this.root);
  }
  get dropInstances(): QueryList<DropListInstance> {
    return viewDropLists(this.root);
  }

  private _groupedDragItems: DragInstance[][] | undefined;
  /** Angular: filled in `ngAfterViewInit` from `getSortedItems()` of every list. */
  get groupedDragItems(): DragInstance[][] {
    if (!this._groupedDragItems) {
      const grouped: DragInstance[][] = [];
      this.dropInstances.forEach((dropZone, index) => {
        if (!grouped[index]) {
          grouped.push([]);
        }

        grouped[index].push(...dropZone.getSortedItems());
      });
      this._groupedDragItems = grouped;
    }
    return this._groupedDragItems;
  }
  set groupedDragItems(value: DragInstance[][]) {
    this._groupedDragItems = value;
  }

  private _todo = ["Zero", "One", "Two", "Three"];
  get todo(): string[] {
    this.tracked();
    return this._todo;
  }
  set todo(value: string[]) {
    this._todo = value;
    this.markForCheck();
  }
  private _done = ["Four", "Five", "Six"];
  get done(): string[] {
    this.tracked();
    return this._done;
  }
  set done(value: string[]) {
    this._done = value;
    this.markForCheck();
  }
  private _extra: string[] = [];
  get extra(): string[] {
    this.tracked();
    return this._extra;
  }
  set extra(value: string[]) {
    this._extra = value;
    this.markForCheck();
  }
  droppedSpy = jasmine.createSpy("dropped spy");
  enteredSpy = jasmine.createSpy("entered spy");
  itemEnteredSpy = jasmine.createSpy("item entered spy");
  todoConnectedTo = signal<ConnectedTo>(undefined);
  doneConnectedTo = signal<ConnectedTo>(undefined);
  extraConnectedTo = signal<ConnectedTo>(undefined);
  hasAnchor = signal(false);

  /** `#todoZone` / `#doneZone` / `#extraZone` (template reference variables: the lists in template order). */
  protected zone(name: "todoZone" | "doneZone" | "extraZone"): DropListInstance {
    return this.dropInstances.get(["todoZone", "doneZone", "extraZone"].indexOf(name))!;
  }

  /** The items of a connected list (`@for (item of items) <div [cdkDragData] (cdkDragEntered) cdkDrag>`). */
  protected connectedItems(items: () => string[]): DOMValue {
    return (
      <For each={items} by={(item) => item}>
        {(item) => (
          <Drag data={item} onEntered={(event) => this.itemEnteredSpy(event)}>
            {item()}
          </Drag>
        )}
      </For>
    );
  }

  /** `CONNECTED_DROP_ZONES_TEMPLATE`. */
  connectedTemplate(): DOMValue {
    return [
      DropListElement({
        data: () => this.todo,
        connectedTo: () => this.todoConnectedTo() || [this.zone("doneZone")],
        hasAnchor: this.hasAnchor,
        onDropped: (event) => this.droppedSpy(event),
        onEntered: (event) => this.enteredSpy(event),
        children: content(this.connectedItems(() => this.todo)),
      }),
      DropListElement({
        data: () => this.done,
        connectedTo: () => this.doneConnectedTo() || [this.zone("todoZone")],
        hasAnchor: this.hasAnchor,
        onDropped: (event) => this.droppedSpy(event),
        onEntered: (event) => this.enteredSpy(event),
        children: content(this.connectedItems(() => this.done)),
      }),
      DropListElement({
        data: () => this.extra,
        connectedTo: () => this.extraConnectedTo()!,
        hasAnchor: this.hasAnchor,
        onDropped: (event) => this.droppedSpy(event),
        onEntered: (event) => this.enteredSpy(event),
        children: content(this.connectedItems(() => this.extra)),
      }),
    ];
  }

  template(): DOMValue {
    return this.connectedTemplate();
  }
}

export class ConnectedDropZonesInsideShadowRootWithNgIf extends ConnectedDropZones {
  override encapsulation: DropListFixture["encapsulation"] = "shadow-dom";

  override template(): DOMValue {
    return <Show when={() => true}>{() => this.connectedTemplate()}</Show>;
  }
}

export class ConnectedDropZonesViaGroupDirective extends ConnectedDropZones {
  override styles = `
    .cdk-drop-list {
      display: block;
      width: 100px;
      min-height: ${ITEM_HEIGHT}px;
      background: hotpink;
    }

    .cdk-drag {
      display: block;
      height: ${ITEM_HEIGHT}px;
      background: red;
    }
  `;
  private _groupDisabled = false;
  get groupDisabled(): boolean {
    this.tracked();
    return this._groupDisabled;
  }
  set groupDisabled(value: boolean) {
    this._groupDisabled = value;
    this.markForCheck();
  }

  override template(): DOMValue {
    return (
      <DropListGroup disabled={() => this.groupDisabled}>
        <DropList data={() => this.todo} onDropped={(event) => this.droppedSpy(event)}>
          <For each={() => this.todo} by={(item) => item}>
            {(item) => <Drag data={item}>{item()}</Drag>}
          </For>
        </DropList>

        <DropList data={() => this.done} onDropped={(event) => this.droppedSpy(event)}>
          <For each={() => this.done} by={(item) => item}>
            {(item) => <Drag data={item}>{item()}</Drag>}
          </For>
        </DropList>
      </DropListGroup>
    );
  }
}

export class ConnectedDropZonesWithSingleItems extends DropListFixture {
  override encapsulation: DropListFixture["encapsulation"] = "none";
  override styles = `
    .cdk-drop-list {
      display: block;
      width: 100px;
      min-height: ${ITEM_HEIGHT}px;
      background: hotpink;
    }

    .cdk-drag {
      display: block;
      height: ${ITEM_HEIGHT}px;
      background: red;
    }
  `;
  get dragItems(): QueryList<DragInstance> {
    return viewDrags(this.root);
  }
  get dropInstances(): QueryList<DropListInstance> {
    return viewDropLists(this.root);
  }

  droppedSpy = jasmine.createSpy("dropped spy");

  template(): DOMValue {
    // `#todoZone` / `#doneZone`: the lists in template order.
    const todoZone = () => this.dropInstances.get(0)!;
    const doneZone = () => this.dropInstances.get(1)!;
    return [
      <DropList connectedTo={() => [doneZone()]} onDropped={(event) => this.droppedSpy(event)}>
        <Drag>One</Drag>
      </DropList>,
      <DropList connectedTo={() => [todoZone()]} onDropped={(event) => this.droppedSpy(event)}>
        <Drag>Two</Drag>
      </DropList>,
    ];
  }
}

export class NestedDropListGroups extends DropListFixture {
  /** `@ViewChild('group')`: the group instance with every list of the group created (Angular creates them with the view). */
  get group(): DropListGroupInstance<DropListInstance> {
    const group = groupOf(this.query("[data-rv-drop-list-group]")) as DropListGroupInstance<DropListInstance>;
    group._wakeAll();
    return group;
  }
  /** `#listOne` / `#listTwo`: the outer lists of the group in template order. */
  get listOne(): DropListInstance {
    return dropListInstance(this.queryAll("[data-rv-drop-list-group] > [data-rv-drop-list]")[0])!;
  }
  get listTwo(): DropListInstance {
    return dropListInstance(this.queryAll("[data-rv-drop-list-group] > [data-rv-drop-list]")[1])!;
  }

  template(): DOMValue {
    return (
      <DropListGroup>
        <DropList>
          <DropList></DropList>
          <DropList></DropList>
        </DropList>

        <DropList></DropList>
      </DropListGroup>
    );
  }
}

/** Angular `<ng-container cdkDropList>`: Rivet `<DropList>` always renders an element, so the instance is created on a comment node. */
export class DropListOnNgContainer extends DropListFixture {
  template(): DOMValue {
    const container = document.createComment("ng-container");
    new DropListInstance(container as unknown as HTMLElement);
    return container;
  }
}

interface SizedItem {
  value: string;
  height: number;
}

export class DraggableInDropZoneWithoutEvents extends DropListFixture {
  get dragItems(): QueryList<DragInstance> {
    return viewDrags(this.root);
  }
  get dropInstance(): DropListInstance {
    return dropListInstance(this.query(".cdk-drop-list"))!;
  }
  items: SizedItem[] = [
    { value: "Zero", height: ITEM_HEIGHT },
    { value: "One", height: ITEM_HEIGHT },
    { value: "Two", height: ITEM_HEIGHT },
    { value: "Three", height: ITEM_HEIGHT },
  ];

  template(): DOMValue {
    return (
      <DropList style={{ width: "100px", background: "pink" }}>
        <For each={() => this.items} by={(item) => item}>
          {(item) => <Drag style={{ width: "100%", background: "red", height: px(item().height) }}>{item().value}</Drag>}
        </For>
      </DropList>
    );
  }
}

/** Component that wraps a drop container and uses OnPush change detection. */
export function WrappedDropContainerComponent(props: { items: string[] | undefined }) {
  const items = props.items;
  return (
    <DropList data={items}>
      <For each={() => items ?? []} by={(item) => item}>
        {(item) => <Drag>{item()}</Drag>}
      </For>
    </DropList>
  );
}

export class ConnectedWrappedDropZones extends DropListFixture {
  override encapsulation: DropListFixture["encapsulation"] = "none";
  override styles = `
    .cdk-drop-list {
      display: block;
      width: 100px;
      min-height: ${ITEM_HEIGHT}px;
      background: hotpink;
    }

    .cdk-drag {
      display: block;
      height: ${ITEM_HEIGHT}px;
      background: red;
    }
  `;
  todo = ["Zero", "One", "Two", "Three"];
  done = ["Four", "Five", "Six"];

  template(): DOMValue {
    return (
      <DropListGroup>
        <WrappedDropContainerComponent items={this.todo} />
        <WrappedDropContainerComponent items={this.done} />
      </DropListGroup>
    );
  }
}

export class DraggableWithCanvasInDropZone extends DraggableInDropZone {
  override template(): DOMValue {
    return (
      <DropList
        class="drop-list scroll-container"
        style={{ width: "100px", background: "pink" }}
        id={this.dropZoneId}
        data={() => this.items}
        onSorted={(event) => this.sortedSpy(event)}
        onDropped={(event) => this.droppedSpy(event)}
      >
        <For each={() => this.items} by={(item) => item}>
          {(item) => {
            // Add a circle to the canvas (Angular: all the canvases, in `ngAfterViewInit`).
            const draw = (canvas: HTMLCanvasElement) => {
              const context = canvas.getContext("2d")!;
              context.beginPath();
              context.arc(50, 50, 40, 0, 2 * Math.PI);
              context.stroke();
            };
            const canvas = <canvas ref={draw} width="100px" height="100px"></canvas>;
            return DragElement(
              {
                data: item,
                style: { width: "100%", background: "red" },
                children: content([<>{item().value}</>, canvas] as unknown as DOMValue),
              },
              () => (this.tracked(), { height: px(item().height), "margin-bottom": px(item().margin) }),
            );
          }}
        </For>
      </DropList>
    );
  }
}

export class DraggableWithInvalidCanvasInDropZone extends DraggableInDropZone {
  override template(): DOMValue {
    return (
      <DropList
        class="drop-list scroll-container"
        style={{ width: "100px", background: "pink" }}
        id={this.dropZoneId}
        data={() => this.items}
        onSorted={(event) => this.sortedSpy(event)}
        onDropped={(event) => this.droppedSpy(event)}
      >
        <For each={() => this.items} by={(item) => item}>
          {(item) => {
            return DragElement(
              {
                data: item,
                style: { width: "100%", background: "red" },
                children: (
                  <>
                    {item().value}
                    <canvas width="0" height="0"></canvas>
                  </>
                ),
              },
              () => (this.tracked(), { height: px(item().height), "margin-bottom": px(item().margin) }),
            );
          }}
        </For>
      </DropList>
    );
  }
}

const NESTED_DRAGS_STYLES = `
  .container {
    height: 200px;
    width: 200px;
    position: absolute;
  }
  .item {
    height: 50px;
    width: 50px;
    position: absolute;
  }
`;

export class NestedDragsComponent extends DropListFixture {
  override styles = NESTED_DRAGS_STYLES;
  get container(): ElementRef {
    return { nativeElement: this.query(".container") };
  }
  get item(): ElementRef {
    return { nativeElement: this.query(".item") };
  }

  containerDragStartedSpy = jasmine.createSpy("container drag started spy");
  containerDragMovedSpy = jasmine.createSpy("container drag moved spy");
  containerDragReleasedSpy = jasmine.createSpy("container drag released spy");
  itemDragStartedSpy = jasmine.createSpy("item drag started spy");
  itemDragMovedSpy = jasmine.createSpy("item drag moved spy");
  itemDragReleasedSpy = jasmine.createSpy("item drag released spy");

  /** `:host` styles. */
  protected hostStyles(): void {
    Object.assign(this.host.style, { height: "400px", width: "400px", position: "absolute" });
  }

  protected itemTemplate(): DOMValue {
    return DragElement({
      class: "item",
      onStarted: (event) => this.itemDragStartedSpy(event),
      onMoved: (event) => this.itemDragMovedSpy(event),
      onReleased: (event) => this.itemDragReleasedSpy(event),
    });
  }

  template(): DOMValue {
    this.hostStyles();
    return DragElement({
      class: "container",
      onStarted: (event) => this.containerDragStartedSpy(event),
      onMoved: (event) => this.containerDragMovedSpy(event),
      onReleased: (event) => this.containerDragReleasedSpy(event),
      children: content(this.itemTemplate()),
    });
  }
}

/** Angular: the inner drag is stamped through `ngTemplateOutlet` from a template declared outside the container. */
export class NestedDragsThroughTemplate extends NestedDragsComponent {
  override template(): DOMValue {
    this.hostStyles();
    // `<ng-template #itemTemplate>` (declared outside the container).
    const itemTemplate = () => this.itemTemplate();
    return DragElement({
      class: "container",
      onStarted: (event) => this.containerDragStartedSpy(event),
      onMoved: (event) => this.containerDragMovedSpy(event),
      onReleased: (event) => this.containerDragReleasedSpy(event),
      children: content(itemTemplate()),
    });
  }
}

export class NestedDropZones extends DropListFixture {
  override styles = `
    .drop-list {
      width: 100px;
      background: pink;
    }
  `;
  get dragItems(): QueryList<DragInstance> {
    return viewDrags(this.root);
  }
  get outerList(): ElementRef {
    return { nativeElement: this.queryAll(".drop-list")[0] };
  }
  get innerList(): ElementRef {
    return { nativeElement: this.queryAll(".drop-list")[1] };
  }
  items = ["Zero", "One", "Two", "Three"];

  template(): DOMValue {
    return (
      <DropList class="drop-list">
        <DropList class="drop-list">
          <For each={() => this.items} by={(item) => item}>
            {(item) => <Drag style={{ width: "100%", background: "red", height: `${ITEM_HEIGHT}px` }}>{item()}</Drag>}
          </For>
        </DropList>
      </DropList>
    );
  }
}

export class PlainStandaloneDropList extends DropListFixture {
  get dropList(): DropListInstance {
    return dropListInstance(this.query(".cdk-drop-list"))!;
  }

  template(): DOMValue {
    return <DropList></DropList>;
  }
}

export class ConnectedDropZonesWithIntermediateSibling extends ConnectedDropZones {
  override encapsulation: DropListFixture["encapsulation"] = "emulated";

  override template(): DOMValue {
    return [
      DropListElement({
        data: () => this.todo,
        connectedTo: () => [this.zone("doneZone")],
        onDropped: (event) => this.droppedSpy(event),
        onEntered: (event) => this.enteredSpy(event),
        children: content(this.connectedItems(() => this.todo)),
      }),
      DropListElement({
        data: () => this.done,
        connectedTo: () => [this.zone("todoZone")],
        onDropped: (event) => this.droppedSpy(event),
        onEntered: (event) => this.enteredSpy(event),
        children: (
          <>
            <div>Hello there</div>
            <div>{content(this.connectedItems(() => this.done))}</div>
          </>
        ),
      }),
    ];
  }
}

export class DraggableWithInputsInDropZone extends DraggableInDropZone {
  inputValue = "hello";

  override template(): DOMValue {
    return (
      <DropList
        class="drop-list scroll-container"
        style={{ width: "100px", background: "pink" }}
        id={this.dropZoneId}
        data={() => this.items}
        onSorted={(event) => this.sortedSpy(event)}
        onDropped={(event) => this.droppedSpy(event)}
      >
        <For each={() => this.items} by={(item) => item}>
          {(item) => {
            const select = (
              <select value={this.inputValue}>
                <option value="goodbye">Goodbye</option>
                <option value="hello">Hello</option>
              </select>
            );
            return DragElement(
              {
                data: item,
                style: { width: "100%", background: "red" },
                children: (
                  <>
                    {item().value}
                    <input value={this.inputValue} />
                    <textarea value={this.inputValue}></textarea>
                    {select}
                  </>
                ),
              },
              () => (this.tracked(), { height: px(item().height), "margin-bottom": px(item().margin) }),
            );
          }}
        </For>
      </DropList>
    );
  }
}

interface RadioItem {
  id: number;
  checked: boolean;
}

export class DraggableWithRadioInputsInDropZone extends DropListFixture {
  get dragItems(): QueryList<DragInstance> {
    return viewDrags(this.root);
  }
  items: RadioItem[] = [
    { id: 1, checked: false },
    { id: 2, checked: false },
    { id: 3, checked: true },
  ];

  template(): DOMValue {
    return (
      <DropList class="drop-list scroll-container" data={() => this.items}>
        <For each={() => this.items} by={(item) => item}>
          {(item) => (
            <Drag data={item}>
              {item().id}
              <input type="radio" name="radio" checked={item().checked} />
            </Drag>
          )}
        </For>
      </DropList>
    );
  }
}

export class ConnectedDropZonesWithAlternateContainer extends ConnectedDropZones {
  override encapsulation: DropListFixture["encapsulation"] = "shadow-dom";
  override styles = CONNECTED_DROP_ZONES_STYLES + `.inner-container {min-height: 50px;}`;

  constructor() {
    super();
    this.done = [];
  }

  override template(): DOMValue {
    return [
      DropListElement({
        data: () => this.todo,
        connectedTo: () => [this.zone("doneZone")],
        onDropped: (event) => this.droppedSpy(event),
        onEntered: (event) => this.enteredSpy(event),
        elementContainerSelector: ".inner-container",
        children: <div class="inner-container">{content(this.connectedItems(() => this.todo))}</div>,
      }),
      DropListElement({
        data: () => this.done,
        connectedTo: () => [this.zone("todoZone")],
        onDropped: (event) => this.droppedSpy(event),
        onEntered: (event) => this.enteredSpy(event),
        elementContainerSelector: ".inner-container",
        children: <div class="inner-container">{content(this.connectedItems(() => this.done))}</div>,
      }),
    ];
  }
}

export class DraggableWithInvalidAlternateContainer extends DropListFixture {
  get dragItems(): QueryList<DragInstance> {
    return viewDrags(this.root);
  }
  get dropInstance(): DropListInstance {
    return dropListInstance(this.query(".cdk-drop-list"))!;
  }
  items = ["Zero", "One", "Two", "Three"];

  template(): DOMValue {
    return (
      <DropList elementContainerSelector=".element-container" style={{ width: "100px", background: "pink" }}>
        <div class="element-container"></div>

        <For each={() => this.items} by={(_item, index) => index}>
          {(item) => (
            <Drag data={item} style={{ width: "100%", height: "50px", background: "red" }}>
              {item()}
            </Drag>
          )}
        </For>
      </DropList>
    );
  }
}

export class DraggableWithMissingAlternateContainer extends DropListFixture {
  get dragItems(): QueryList<DragInstance> {
    return viewDrags(this.root);
  }
  get dropInstance(): DropListInstance {
    return dropListInstance(this.query(".cdk-drop-list"))!;
  }
  items = ["Zero", "One", "Two", "Three"];

  template(): DOMValue {
    return (
      <DropList elementContainerSelector="does-not-exist" style={{ width: "100px", background: "pink" }}>
        <For each={() => this.items} by={(_item, index) => index}>
          {(item) => (
            <Drag data={item} style={{ width: "100%", height: "50px", background: "red" }}>
              {item()}
            </Drag>
          )}
        </For>
      </DropList>
    );
  }
}
