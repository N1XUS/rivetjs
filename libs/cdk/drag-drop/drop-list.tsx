// Ported from Angular Components (src/cdk/drag-drop/directives/drop-list.ts — host bindings), MIT, © Google LLC.
// Rivet: `cdkDropList` as a component rendering its element (`elementType`, default `div`) with
// `class="cdk-drop-list"` (+ `rv-DropList` when `class` is omitted), its `id` (default
// `cdk-drop-list-<id>`), `data-rv-drop-list` and `data-orientation`. Its handlers create the
// `DropListInstance` (directives/drop-list.ts) — when an item inside is pressed (`mousedown` /
// `touchstart` reach it too, so a cold press loads both chunks) or when another list wakes it
// (connected lists, groups). Inputs are props (`cdkDropListData` → `data`, …), outputs `on*`.
import { effect, onCleanup, useContext } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import type { StyleObject } from "@rivetjs/runtime/style";
import { createId } from "@rivetjs/cdk/id";
import { hostDOMProps, type AriaDOMAttributes, type GlobalDOMAttributes } from "@rivetjs/cdk/dom-props";
import { DirectionalityContext } from "../bidi/index.ts";
import { DragDropConfigContext } from "./directives/config.ts";
import { listHost, read } from "./directives/registry.ts";
import type { DropListInputs, DropListSetup } from "./directives/drop-list.ts";

/**
 * Creates the list's instance (`lazy-refs.ts` `dropListHostEvent`) through the registry's `listHost` (BIG-UI): set once a
 * `<Drag>` chunk or an instance lookup (`dropListInstance`) is in — the only code that needs a list's instance — so a page
 * whose lists never meet an item (a scheduler's external-drop hit area, a list not rendered) ships none of it.
 */
function dropListHostEvent<T>(event: Event, setup: DropListSetup<T>): void {
  listHost.event?.(event, setup as never);
}

/** Global DOM events DropList handles itself; the user's handlers run after its own. */
const OWNED = ["onMouseDown", "onTouchStart"] as const;

/** Preload the drag-drop handlers when a list scrolls into view (first press runs synchronously). */
export const preload = "visible";

export interface DropListProps<T = any> extends DropListInputs<T>, GlobalDOMAttributes<HTMLElement>, AriaDOMAttributes {
  /** Element to render. @default "div" */
  elementType?: "div" | "ul" | "ol" | "tbody" | "section";
  /** Unique ID for the drop zone. Can be used as a reference in the `connectedTo` of another `DropList`. */
  id?: string;
  /** @default "rv-DropList" (always with Angular's `cdk-drop-list`) */
  class?: string;
  /** Inline style of the element. */
  style?: StyleObject;
  children?: Content;
}

/** Container that wraps a set of draggable items (Angular `cdkDropList`). */
export function DropList<T = any>(props: DropListProps<T>) {
  const config = useContext(DragDropConfigContext);
  const dir = useContext(DirectionalityContext);
  const inputs: DropListInputs<T> = {
    connectedTo: props.connectedTo,
    data: props.data,
    orientation: props.orientation,
    lockAxis: props.lockAxis,
    disabled: props.disabled,
    sortingDisabled: props.sortingDisabled,
    enterPredicate: props.enterPredicate,
    sortPredicate: props.sortPredicate,
    autoScrollDisabled: props.autoScrollDisabled,
    autoScrollStep: props.autoScrollStep,
    elementContainerSelector: props.elementContainerSelector,
    hasAnchor: props.hasAnchor,
    onDropped: props.onDropped,
    onEntered: props.onEntered,
    onExited: props.onExited,
    onSorted: props.onSorted,
  };
  const setup: DropListSetup<T> = { inputs, config, dir };
  // Read every prop up front: an element with a spread resumes as one binding over all its
  // attributes, and reading `props` there would capture the whole props object (children included).
  const dom = hostDOMProps(props, OWNED);
  const { onMouseDown, onTouchStart, elementType, style, children } = props;
  const id = props.id ?? "cdk-drop-list-" + createId();
  const disabled = props.disabled;
  const orientation = props.orientation;
  const className = "cdk-drop-list " + (props.class ?? "rv-DropList");
  const isDisabled = () => !!(read(disabled) ?? config?.draggingDisabled);
  const listOrientation = () => read(orientation) ?? config?.listOrientation ?? "vertical";
  const host = (event: Event) => dropListHostEvent(event, setup);
  const mouseDown = (event: MouseEvent) => {
    dropListHostEvent(event, setup);
    onMouseDown?.(event as never);
  };
  const touchStart = (event: TouchEvent) => {
    dropListHostEvent(event, setup);
    onTouchStart?.(event as never);
  };

  // Client render only: on the server the ref stays empty.
  const element = ref<HTMLElement>();
  const node =
    elementType === "ul" ? (
      <ul
        {...dom}
        ref={element}
        id={id}
        class={className}
        class:cdk-drop-list-disabled={isDisabled()}
        data-disabled={isDisabled() ? "true" : undefined}
        data-orientation={listOrientation()}
        data-rv-drop-list=""
        style={style}
        onMouseDown={mouseDown}
        onTouchStart={touchStart}
        onDragStart={host}
      >
        {children}
      </ul>
    ) : elementType === "ol" ? (
      <ol
        {...dom}
        ref={element}
        id={id}
        class={className}
        class:cdk-drop-list-disabled={isDisabled()}
        data-disabled={isDisabled() ? "true" : undefined}
        data-orientation={listOrientation()}
        data-rv-drop-list=""
        style={style}
        onMouseDown={mouseDown}
        onTouchStart={touchStart}
        onDragStart={host}
      >
        {children}
      </ol>
    ) : elementType === "tbody" ? (
      <tbody
        {...dom}
        ref={element}
        id={id}
        class={className}
        class:cdk-drop-list-disabled={isDisabled()}
        data-disabled={isDisabled() ? "true" : undefined}
        data-orientation={listOrientation()}
        data-rv-drop-list=""
        style={style}
        onMouseDown={mouseDown}
        onTouchStart={touchStart}
        onDragStart={host}
      >
        {children}
      </tbody>
    ) : elementType === "section" ? (
      <section
        {...dom}
        ref={element}
        id={id}
        class={className}
        class:cdk-drop-list-disabled={isDisabled()}
        data-disabled={isDisabled() ? "true" : undefined}
        data-orientation={listOrientation()}
        data-rv-drop-list=""
        style={style}
        onMouseDown={mouseDown}
        onTouchStart={touchStart}
        onDragStart={host}
      >
        {children}
      </section>
    ) : (
      <div
        {...dom}
        ref={element}
        id={id}
        class={className}
        class:cdk-drop-list-disabled={isDisabled()}
        data-disabled={isDisabled() ? "true" : undefined}
        data-orientation={listOrientation()}
        data-rv-drop-list=""
        style={style}
        onMouseDown={mouseDown}
        onTouchStart={touchStart}
        onDragStart={host}
      >
        {children}
      </div>
    );

  // Client-rendered lists are destroyed with their element (`ngOnDestroy`).
  // (`getOwner()` is set on the server too: the element ref is what tells a client render apart.)
  // The ref is reset by its own cleanup: keep the element seen last.
  let rendered: HTMLElement | undefined;
  effect(() => {
    rendered = element() ?? rendered;
  });
  onCleanup(() => {
    if (rendered) listHost.destroyed?.(rendered);
  });
  return node;
}
