// Ported from Angular Components (src/cdk/drag-drop/directives/drag.ts — host bindings), MIT, © Google LLC.
// Rivet: `cdkDrag` as a component rendering its element (`elementType`, default `div`) with
// `class="cdk-drag"` (+ `rv-Drag` when `class` is omitted), `data-rv-drag` and the handlers that create
// the `DragInstance` (directives/drag.ts) on the first press — nothing runs before that, on resumed and
// client-rendered pages alike. Inputs are props (`cdkDragData` → `data`, …; plain values or signals),
// outputs `on*` callbacks (`cdkDragStarted` → `onStarted`, …). Server markup: `cdk-drag-disabled` /
// `data-disabled` for an own `disabled`, the `freeDragPosition` transform. Upstream sets no
// touch-action on the root at rest (only on handles and while dragging), so neither does this.
import { effect, onCleanup, useContext } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import type { StyleObject } from "@rivetjs/runtime/style";
import { hostDOMProps, type GlobalDOMAttributes, type HostDOMAttributes } from "@rivetjs/cdk/dom-props";
import { DirectionalityContext } from "../bidi/index.ts";
import { getTransform } from "./dom/styling.ts";
import { DragDropConfigContext } from "./directives/config.ts";
import { read } from "./directives/registry.ts";
import type { DragInputs, DragSetup } from "./directives/drag.ts";
import { dragDestroyed, dragHostEvent, dragMounted, syncHandleInteractions, watchRoot } from "./lazy-refs.ts";
import { drags } from "./directives/registry.ts";

/**
 * Global DOM props Drag handles itself: mouse/touch start (the user's handlers run after its own) and
 * `style` (merged with the engine's `style:transform`; a spread `style` key would be written twice on
 * the server and overwrite the transform in the browser).
 */
const OWNED = ["onMouseDown", "onTouchStart", "style"] as const;

/** Preload the drag-drop handlers when a draggable scrolls into view (first press runs synchronously). */
export const preload = "visible";

export interface DragProps<T = any> extends DragInputs<T>, GlobalDOMAttributes<HTMLElement>, HostDOMAttributes<HTMLElement> {
  /** Element to render. @default "div" */
  elementType?: "div" | "li" | "tr" | "span" | "section" | "article";
  id?: string;
  /** @default "rv-Drag" (always with Angular's `cdk-drag`) */
  class?: string;
  /** Inline style of the element (the engine adds its own drag styles on top). */
  style?: StyleObject;
  /**
   * The drag element is also a handle when using an alternate root (`rootElementSelector`; Angular:
   * `cdkDrag` + `cdkDragHandle` on one element).
   */
  isHandle?: boolean;
  children?: Content;
}

/** Element that can be moved inside a `DropList` container, or freely (Angular `cdkDrag`). */
export function Drag<T = any>(props: DragProps<T>) {
  const config = useContext(DragDropConfigContext);
  const dir = useContext(DirectionalityContext);
  const inputs: DragInputs<T> = {
    data: props.data,
    lockAxis: props.lockAxis,
    rootElementSelector: props.rootElementSelector,
    boundaryElement: props.boundaryElement,
    dragStartDelay: props.dragStartDelay,
    freeDragPosition: props.freeDragPosition,
    disabled: props.disabled,
    constrainPosition: props.constrainPosition,
    previewClass: props.previewClass,
    previewContainer: props.previewContainer,
    scale: props.scale,
    onStarted: props.onStarted,
    onReleased: props.onReleased,
    onEnded: props.onEnded,
    onEntered: props.onEntered,
    onExited: props.onExited,
    onDropped: props.onDropped,
    onMoved: props.onMoved,
  };
  // Client render: set once rendered. Resumed page: revived holding the server element, reset when its region dies;
  // the instance (created by the first press) is destroyed with it (`DragInstance._releaseWith`).
  const element = ref<HTMLElement>();
  const setup: DragSetup<T> = { inputs, config, dir, element };
  // Read every prop up front: an element with a spread resumes as one binding over all its
  // attributes, and reading `props` there would capture the whole props object (children included).
  const dom = hostDOMProps(props, OWNED);
  const { onMouseDown, onTouchStart, id, elementType, style, children } = props;
  const disabled = props.disabled;
  const rootSelector = props.rootElementSelector;
  const position = props.freeDragPosition;
  const scale = props.scale;
  const selfHandle = props.isHandle ? "" : undefined;
  const className = "cdk-drag " + (props.class ?? "rv-Drag");
  const isDisabled = () => !!(read(disabled) ?? config?.draggingDisabled);
  const transform = () => {
    const value = read(position);
    if (!value) return undefined;
    const factor = 1 / (Number(read(scale) ?? 1) || 1);
    return getTransform(value.x * factor, value.y * factor);
  };
  const host = (event: Event) => dragHostEvent(event, setup);
  const mouseDown = (event: MouseEvent) => {
    dragHostEvent(event, setup);
    onMouseDown?.(event as never);
  };
  const touchStart = (event: TouchEvent) => {
    dragHostEvent(event, setup);
    onTouchStart?.(event as never);
  };

  const node =
    elementType === "li" ? (
      <li
        {...dom}
        ref={element}
        id={id}
        class={className}
        class:cdk-drag-disabled={isDisabled()}
        data-disabled={isDisabled() ? "true" : undefined}
        data-rv-drag=""
        data-rv-drag-self-handle={selfHandle}
        data-rv-free-position={transform() ? "" : undefined}
        style={style}
        style:transform={transform()}
        onMouseDown={mouseDown}
        onTouchStart={touchStart}
        onDragStart={host}
      >
        {children}
      </li>
    ) : elementType === "tr" ? (
      <tr
        {...dom}
        ref={element}
        id={id}
        class={className}
        class:cdk-drag-disabled={isDisabled()}
        data-disabled={isDisabled() ? "true" : undefined}
        data-rv-drag=""
        data-rv-drag-self-handle={selfHandle}
        data-rv-free-position={transform() ? "" : undefined}
        style={style}
        style:transform={transform()}
        onMouseDown={mouseDown}
        onTouchStart={touchStart}
        onDragStart={host}
      >
        {children}
      </tr>
    ) : elementType === "span" ? (
      <span
        {...dom}
        ref={element}
        id={id}
        class={className}
        class:cdk-drag-disabled={isDisabled()}
        data-disabled={isDisabled() ? "true" : undefined}
        data-rv-drag=""
        data-rv-drag-self-handle={selfHandle}
        data-rv-free-position={transform() ? "" : undefined}
        style={style}
        style:transform={transform()}
        onMouseDown={mouseDown}
        onTouchStart={touchStart}
        onDragStart={host}
      >
        {children}
      </span>
    ) : elementType === "section" ? (
      <section
        {...dom}
        ref={element}
        id={id}
        class={className}
        class:cdk-drag-disabled={isDisabled()}
        data-disabled={isDisabled() ? "true" : undefined}
        data-rv-drag=""
        data-rv-drag-self-handle={selfHandle}
        data-rv-free-position={transform() ? "" : undefined}
        style={style}
        style:transform={transform()}
        onMouseDown={mouseDown}
        onTouchStart={touchStart}
        onDragStart={host}
      >
        {children}
      </section>
    ) : elementType === "article" ? (
      <article
        {...dom}
        ref={element}
        id={id}
        class={className}
        class:cdk-drag-disabled={isDisabled()}
        data-disabled={isDisabled() ? "true" : undefined}
        data-rv-drag=""
        data-rv-drag-self-handle={selfHandle}
        data-rv-free-position={transform() ? "" : undefined}
        style={style}
        style:transform={transform()}
        onMouseDown={mouseDown}
        onTouchStart={touchStart}
        onDragStart={host}
      >
        {children}
      </article>
    ) : (
      <div
        {...dom}
        ref={element}
        id={id}
        class={className}
        class:cdk-drag-disabled={isDisabled()}
        data-disabled={isDisabled() ? "true" : undefined}
        data-rv-drag=""
        data-rv-drag-self-handle={selfHandle}
        data-rv-free-position={transform() ? "" : undefined}
        style={style}
        style:transform={transform()}
        onMouseDown={mouseDown}
        onTouchStart={touchStart}
        onDragStart={host}
      >
        {children}
      </div>
    );

  // Client-rendered: join a list that is being dragged over (Angular `addItem` on construction) and
  // destroy the instance with the element (`ngOnDestroy`). Server-rendered drags (resumed page, no component code):
  // the instance goes when the revived element ref resets (its region died), `DragInstance._releaseWith`.
  // (`getOwner()` is set on the server too: the element ref is what tells a client render apart.)
  queueMicrotask(() => {
    const el = element();
    if (el) dragMounted(el);
  });
  if ((globalThis as { document?: unknown }).document !== undefined) {
    // Browser (client render or a resumed page's adopt run; M6-CUT: the server `ref()` no longer carries an `id`). Angular creates the DragRef with the
    // directive, so an alternate root (`rootElementSelector`) starts a drag before the drag element
    // was ever pressed: presses on a watched root create the instance first (lazy-refs.ts).
    if (rootSelector !== undefined || config?.rootElementSelector !== undefined) watchRoot(element, () => read(rootSelector) ?? config?.rootElementSelector);
    // `DragRef.disabled` toggles the handles' native interactions (`toggleNativeDragInteractions`);
    // until the ref exists the handles carry the enabled styles `<DragHandle>` rendered.
    effect(() => {
      const el = element();
      const off = isDisabled();
      if (el && !drags.has(el)) syncHandleInteractions(el, off);
    });
  }
  // The ref is reset by its own cleanup: keep the element seen last.
  let rendered: HTMLElement | undefined;
  effect(() => {
    rendered = element() ?? rendered;
  });
  onCleanup(() => {
    if (rendered) dragDestroyed(rendered);
  });
  return node;
}
