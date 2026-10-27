// Ported from Angular Components (src/cdk/drag-drop/directives/drag-handle.ts — host bindings), MIT, © Google LLC.
// Rivet: `cdkDragHandle` as a component rendering its element (`elementType`, default `div`) with
// `class="cdk-drag-handle"` (+ `rv-DragHandle` when `class` is omitted), `data-rv-drag-handle` and, while
// enabled, the native-interaction styles `DragRef.withHandles` applies (`touch-action: none`, …,
// byte-identical to `toggleNativeDragInteractions(handle, false)`), so a cold touch on a server-rendered
// handle never scrolls. `disabled` (`cdkDragHandleDisabled`) renders `data-disabled`; the owning
// `DragInstance` reads handles from the DOM (directives/drag-handle.ts), so a handle ships no code.
// Merged name (spec): the React Aria drag button (`dragButtonProps`) attaches to this same component
// when a react-aria draggable is around (later phase): it will merge its attributes / press handlers
// into `dom` below.
import { effect, onCleanup } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import type { StyleObject } from "@rivetjs/runtime/style";
import { hostDOMProps, type AriaDOMAttributes, type GlobalDOMAttributes } from "@rivetjs/cdk/dom-props";
import { read, type MaybeAccessor } from "./directives/registry.ts";
import { handleChanged, handleOwner } from "./lazy-refs.ts";
import { nativeDragInteractionStyles } from "./dom/styling.ts";

export interface DragHandleProps extends GlobalDOMAttributes<HTMLElement>, AriaDOMAttributes {
  /** Whether starting to drag through this handle is disabled (Angular `cdkDragHandleDisabled`). */
  disabled?: MaybeAccessor<boolean | undefined>;
  /** Element to render. @default "div" */
  elementType?: "div" | "span" | "button";
  id?: string;
  /** @default "rv-DragHandle" (always with Angular's `cdk-drag-handle`) */
  class?: string;
  /** Inline style of the element (the native-interaction styles are added while enabled). */
  style?: StyleObject;
  children?: Content;
}

/** Handle that can be used to drag a `Drag` instance (Angular `cdkDragHandle`). */
export function DragHandle(props: DragHandleProps) {
  // Read every prop up front: an element with a spread resumes as one binding over all its
  // attributes, and reading `props` there would capture the whole props object (children included).
  const dom = hostDOMProps(props);
  const { id, elementType, children } = props;
  const userStyle = props.style;
  const disabled = props.disabled;
  const className = "cdk-drag-handle " + (props.class ?? "rv-DragHandle");
  const isDisabled = () => !!read(disabled);
  // `toggleNativeDragInteractions(handle, false)` (dom/styling.ts) as the inline style of an enabled handle.
  const styles = nativeDragInteractionStyles(false);
  const style = () => (isDisabled() ? userStyle : { ...userStyle, ...styles });

  // Client render only: on the server the ref stays empty.
  const element = ref<HTMLElement>();
  const node =
    elementType === "span" ? (
      <span {...dom} ref={element} id={id} class={className} data-rv-drag-handle="" data-disabled={isDisabled() ? "true" : undefined} style={style()}>
        {children}
      </span>
    ) : elementType === "button" ? (
      <button
        {...dom}
        ref={element}
        type="button"
        id={id}
        class={className}
        data-rv-drag-handle=""
        data-disabled={isDisabled() ? "true" : undefined}
        style={style()}
      >
        {children}
      </button>
    ) : (
      <div {...dom} ref={element} id={id} class={className} data-rv-drag-handle="" data-disabled={isDisabled() ? "true" : undefined} style={style()}>
        {children}
      </div>
    );

  // Client-rendered: a handle added / removed / toggled after its drag item was created re-syncs the
  // item's handles (Angular `_addHandle` / `_removeHandle` / `_stateChanges`).
  // (`getOwner()` is set on the server too: the element ref is what tells a client render apart.)
  let owner: HTMLElement | null = null;
  effect(() => {
    isDisabled();
    queueMicrotask(() => {
      const el = element();
      if (el) handleChanged((owner = handleOwner(el) ?? owner));
    });
  });
  onCleanup(() => queueMicrotask(() => handleChanged(owner)));
  return node;
}
