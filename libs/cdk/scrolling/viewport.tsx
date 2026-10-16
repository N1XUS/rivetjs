// Ported from Angular Components (src/cdk/scrolling/{virtual-scroll-viewport.html,virtual-for-of.ts,
// virtual-scrollable-element.ts,scrollable.ts}), MIT, © Google LLC.
// Rivet components: <CdkVirtualScrollViewport state> (viewport + content wrapper + spacer),
// <CdkVirtualForOf state> (keyed rows of the rendered range), <CdkVirtualScrollableElement> (an
// ancestor scroll container). State from `createVirtualScroll` is shared explicitly (children render
// before parents: no DI). Server: the first range is rendered; the browser engine
// (virtual-scroll-viewport.ts) starts on the first scroll / wheel / pointer / focus / key interaction.
import { untrack } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import type { Content, Slot } from "@rivetjs/runtime/jsx-runtime";
import type { ListRange } from "./virtual-scroll-strategy.ts";
import type { VirtualScrollState } from "./state.ts";
import { viewportInteract } from "./behaviour.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "@rivetjs/cdk/dom-props";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";

/** Global DOM events the viewport handles itself (engine start); the user's handlers run after its own. */
const OWNED = ["onScroll", "onWheel", "onPointerDown"] as const;
const SCROLLABLE_OWNED = ["onScroll"] as const;

/** Global DOM events / attributes go to the viewport element. */
export interface CdkVirtualScrollViewportProps<T> extends GlobalDOMAttributes<HTMLDivElement> {
  state: VirtualScrollState<T>;
  class?: string;
  label?: string;
  /** Index of the first visible item (fixed strategy; Angular `scrolledIndexChange`). */
  onScrolledIndexChange?: (index: number) => void;
  /** Rendered range changes (Angular `renderedRangeStream`). */
  onRenderedRangeChange?: (range: ListRange) => void;
  /** Row identity for a row-template child (Angular `cdkVirtualForTrackBy`), absolute index. */
  trackBy?: (index: number, item: T) => unknown;
  /**
   * A row template (Angular `<div *cdkVirtualFor>` directly in the viewport): rows render straight
   * into the content wrapper. Or content holding a `<CdkVirtualForOf>` under a native element
   * (`<ul><CdkVirtualForOf/></ul>`, `<table><tbody>…`): its own update region.
   */
  children?: Slot<[item: () => T, context: CdkVirtualForOfContext]> | Content;
}

/** A viewport that virtualizes its scrolling with the help of `CdkVirtualForOf`. */
export function CdkVirtualScrollViewport<T>(props: CdkVirtualScrollViewportProps<T>) {
  const { state, onScrolledIndexChange, onRenderedRangeChange, trackBy, children, onScroll, onWheel, onPointerDown } = props;
  const callbacks = { onScrolledIndexChange, onRenderedRangeChange };
  // A row template is a user render function `(item, context) => …`; plain content arrives as a compiler slot.
  const rowTemplate = typeof children === "function" && !isSlot(children);
  const horizontal = state.orientation === "horizontal";
  const cls =
    "cdk-virtual-scroll-viewport" +
    (state.scrollable === "self" ? " cdk-virtual-scrollable" : "") +
    (horizontal ? " cdk-virtual-scroll-orientation-horizontal" : " cdk-virtual-scroll-orientation-vertical") +
    (props.class ? " " + props.class : "");
  // Read every prop up front: an element with a spread resumes as one binding over all its
  // attributes, and reading `props` there would capture the whole props object (children included).
  const dom = globalDOMProps(props, OWNED);
  const label = props.label;
  return (
    <div
      {...dom}
      id={state.id}
      class={cls}
      data-rv-virtual-viewport=""
      aria-label={label}
      onScroll={
        onScroll
          ? (event) => {
              viewportInteract(state, event, callbacks);
              onScroll(event);
            }
          : (event) => viewportInteract(state, event, callbacks)
      }
      onWheel={
        onWheel
          ? (event) => {
              viewportInteract(state, event, callbacks);
              onWheel(event);
            }
          : (event) => viewportInteract(state, event, callbacks)
      }
      onPointerDown={
        onPointerDown
          ? (event) => {
              viewportInteract(state, event, callbacks);
              onPointerDown(event);
            }
          : (event) => viewportInteract(state, event, callbacks)
      }
      onFocusIn={(event) => viewportInteract(state, event, callbacks)}
      onKeyDown={(event) => viewportInteract(state, event, callbacks)}
    >
      <div class="cdk-virtual-scroll-content-wrapper" style={{ transform: state.transform() }}>
        {/* The row-template For sits directly in the wrapper: its own update region (a For inside a
            conditional gets none — queued compiler work); with content children it renders nothing. */}
        {rowTemplate ? <template data-rv-vfor={state.id}></template> : null}
        <For
          each={() => (rowTemplate ? state.items().slice(state.range().start, state.range().end) : [])}
          by={(item, i) => (trackBy ? trackBy(i + untrack(state.range).start, item) : item)}
        >
          {(item, i) => (children as Slot<[item: () => T, context: CdkVirtualForOfContext]>)(item, rowContext(state, i))}
        </For>
        {rowTemplate ? <template data-rv-vfor-end=""></template> : renderSlot(children as Content)}
      </div>
      <div
        class="cdk-virtual-scroll-spacer"
        style={{ width: horizontal ? `${state.totalSize()}px` : undefined, height: horizontal ? undefined : `${state.totalSize()}px` }}
      ></div>
      {state.scrollable === "window" ? (
        // Window scrolling: a document listener (runtime boots at load, the chunk loads on the first page scroll).
        <span hidden document:onScroll={(event) => viewportInteract(state, event, callbacks)}></span>
      ) : null}
    </div>
  );
}

/** Row context accessors for absolute row `i` of the rendered range. */
function rowContext(state: VirtualScrollState<any>, i: () => number): CdkVirtualForOfContext {
  const index = () => state.range().start + i();
  const count = () => state.items().length;
  return {
    index,
    count,
    first: () => index() === 0,
    last: () => index() === count() - 1,
    even: () => index() % 2 === 0,
    odd: () => index() % 2 !== 0,
  };
}

/** Row context (Angular `CdkVirtualForOfContext`). */
export interface CdkVirtualForOfContext {
  /** Absolute index in the data. */
  index: () => number;
  count: () => number;
  first: () => boolean;
  last: () => boolean;
  even: () => boolean;
  odd: () => boolean;
}

export interface CdkVirtualForOfProps<T> {
  state: VirtualScrollState<T>;
  /** Item identity (Angular `cdkVirtualForTrackBy`), called with the absolute index. Default: the item. */
  trackBy?: (index: number, item: T) => unknown;
  /** Row template (Angular `*cdkVirtualFor` template / `cdkVirtualForTemplate`). One root element per row. */
  children: Slot<[item: () => T, context: CdkVirtualForOfContext]>;
}

/**
 * Renders the rendered range of `state.items` as keyed rows (reused across scrolls by identity). Place it
 * under a native element (`<ul>`, `<tbody>`, `<div>`) so it gets its own update region; directly in the
 * viewport, pass the row template as the viewport's child instead.
 */
export function CdkVirtualForOf<T>(props: CdkVirtualForOfProps<T>) {
  const { state, trackBy, children: render } = props;
  return (
    <>
      <template data-rv-vfor={state.id}></template>
      <For
        each={() => state.items().slice(state.range().start, state.range().end)}
        by={(item, i) => (trackBy ? trackBy(i + untrack(state.range).start, item) : item)}
      >
        {(item, i) => render(item, rowContext(state, i))}
      </For>
      <template data-rv-vfor-end=""></template>
    </>
  );
}

/** An ancestor scroll container for viewports created with `scrollable: "element"` (Angular `cdkVirtualScrollingElement`). */
export function CdkVirtualScrollableElement(
  props: { states: readonly VirtualScrollState<any>[]; class?: string; id?: string; children?: Content } & GlobalDOMAttributes<HTMLDivElement>,
) {
  const { states, onScroll } = props;
  // Read every prop up front: an element with a spread resumes as one binding over all its
  // attributes, and reading `props` there would capture the whole props object (children included).
  const dom = globalDOMProps(props, SCROLLABLE_OWNED);
  const id = props.id,
    className = "cdk-virtual-scrollable" + (props.class ? " " + props.class : "");
  return (
    <div
      {...dom}
      id={id}
      class={className}
      data-rv-virtual-scrollable=""
      onScroll={
        onScroll
          ? (event) => {
              states.forEach((state) => viewportInteract(state, event));
              onScroll(event);
            }
          : (event) => states.forEach((state) => viewportInteract(state, event))
      }
    >
      {props.children}
    </div>
  );
}
