// Ported from react-aria-components `DropZone` (packages/react-aria-components/src/DropZone.tsx), Apache-2.0, © Adobe,
// with react-aria `useDrop` (native drag events, `./dnd.ts`) and `useClipboard` (paste).
// A drop zone is an area into which one or multiple objects can be dragged and dropped: a `div` taking the native drag
// events, with a visually hidden `<button>` as its focus target (focus ring, paste, the zone's accessible name).
// Rivet:
// - Resumable, nothing before the first event: the drag handlers are the zone's own JSX handlers, the drop state lives
//   per element (`./dnd.ts`), `data-hovered` / `data-focused` / `data-focus-visible` / `data-drop-target` are written by
//   the handlers (signals only when a `class` / `style` / `children` function asks for the states).
// - Paste (RA useClipboard): `onPaste` / `on:beforepaste` on the hidden button itself (clipboard events target the
//   focused element) instead of document listeners added while focused; same effect, no global listener.
// - The hidden button's `aria-labelledby` = its own id + the `Text slot="label"` id (`TextContext`); the label id is
//   always listed (RA `useSlotId` drops it when no label renders: a client effect here would load the zone's code on
//   idle). The button's own `aria-label` keeps the name valid without a label.
// - Focus on press: the zone's `pointerup` (primary button) instead of RAC's `onClick` (a click handler on the
//   non-focusable zone trips the dev a11y `click-events` rule; the zone is reached by keyboard through its hidden button).
// - Not ported yet (DnD lane): the keyboard / screen reader drop session (RA `DragManager`: Enter on the hidden button
//   during a virtual drag). A drop from outside the page and paste work; a keyboard user picks files with a
//   `FileTrigger` child.
// - Resumed page: the first `dragenter` loads the zone's code; the next `dragover` (browsers repeat it every ~50 ms)
//   enters in its place (`./dnd.ts`). A drop before the code has loaded falls back to the browser's default.
// `render` (RAC DOMRenderProps): given, the attributes go to `render(attrs, DropZoneRenderProps)`.
import { createContext, signal, untrack, type Signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { formatMessage } from "../_adapters/intl.ts";
import { visuallyHidden } from "../a11y/index.ts";
import { focusRingBlur, focusRingIn } from "../focus/focus-ring.tsx";
import { useLocale } from "../i18n/index.ts";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import { hoverStateOver, setDataAttr, type InteractionStateOptions } from "../utils/data-attrs.tsx";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { getEventTarget, nodeContains } from "../utils/dom-core.ts";
import { createId } from "../utils/id.ts";
import { isFocusable } from "../interactions/utils.ts";
import { focusWithoutScrolling } from "../utils/transitions.ts";
import { type DOMRenderProps } from "../utils/render.ts";
import { contextProps, renderPropsOf, type ContextValue, type RefValue, type RenderProps, type SlotProps } from "../slots/index.tsx";
import { TextContext } from "../text/index.tsx";
import type { HoverEvents } from "../interactions/hover.tsx";
import type { AriaLabelingProps } from "../utils/types.ts";
import { hasLive, liveOptions } from "../utils/live.tsx";
import { dropDragEnter, dropDragLeave, dropDragOver, dropDrop, readFromDataTransfer, type DropHandlerOptions, type DropOptions } from "./dnd.ts";
import { strings } from "./intl.ts";

export {
  DIRECTORY_DRAG_TYPE,
  DragTypes,
  isDirectoryDropItem,
  isFileDropItem,
  isTextDropItem,
  readFromDataTransfer,
  type DirectoryDropItem,
  type DragType,
  type DragTypesLike,
  type DropActivateEvent,
  type DropEnterEvent,
  type DropEvent,
  type DropExitEvent,
  type DropItem,
  type DropMoveEvent,
  type DropOperation,
  type DropOptions,
  type FileDropItem,
  type TextDropItem,
} from "./dnd.ts";

/** Global DOM events / props the zone handles itself. */
const OWNED = ["onPointerUp", "onPointerOver", "onDragEnter", "onDragOver", "onDragLeave", "onDrop", "style", "render"] as const;

export interface DropZoneRenderProps {
  /** Whether the dropzone is currently hovered with a mouse. `[data-hovered]` */
  isHovered: () => boolean;
  /** Whether the dropzone is focused, either via a mouse or keyboard. `[data-focused]` */
  isFocused: () => boolean;
  /** Whether the dropzone is keyboard focused. `[data-focus-visible]` */
  isFocusVisible: () => boolean;
  /** Whether the dropzone is the drop target. `[data-drop-target]` */
  isDropTarget: () => boolean;
  /** Whether the dropzone is disabled. `[data-disabled]` */
  isDisabled: () => boolean;
}

export interface DropZoneProps
  extends
    Omit<DropOptions, "getDropOperationForPoint">,
    HoverEvents,
    RenderProps<DropZoneRenderProps>,
    DOMRenderProps<"div", DropZoneRenderProps>,
    SlotProps,
    AriaLabelingProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** Whether the drop target is disabled: it accepts no drops and no paste (may be an accessor). */
  isDisabled?: MaybeAccessor<boolean | undefined>;
  /** @default "rv-DropZone" */
  class?: RenderProps<DropZoneRenderProps>["class"];
  /** The zone element's id. */
  id?: string;
  ref?: RefValue<HTMLDivElement>;
}

/** RAC `DropZoneContext`. */
export const DropZoneContext = createContext<ContextValue<DropZoneProps, HTMLDivElement>>({});

const isFn = (v: unknown): boolean => typeof v === "function";

/** The zone of a hidden button: button → visually hidden span → zone. */
const zoneOf = (button: Element): Element | null => button.parentElement?.parentElement ?? null;

interface ZoneStates {
  isHovered?: Signal<boolean>;
  isFocused?: Signal<boolean>;
  isFocusVisible?: Signal<boolean>;
  isDropTarget?: Signal<boolean>;
}

// The hidden button's focus ring, writing the zone's attributes (RAC: `useFocusRing` on the button, data attributes on the zone).
const rings = new WeakMap<Element, object>();
function ringOf(zone: Element, states: ZoneStates): object {
  let ring = rings.get(zone);
  if (!ring) {
    let focused = false;
    ring = {
      props: {},
      focused: Object.assign(() => focused, {
        set: (v: boolean) => ((focused = v), setDataAttr(zone, "data-focused", v), states.isFocused?.set(v)),
      }),
      visible: { set: (v: boolean) => (setDataAttr(zone, "data-focus-visible", v), states.isFocusVisible?.set(v)) },
      state: { isFocused: false, isFocusVisible: false, unsubscribe: null },
    };
    rings.set(zone, ring);
  }
  return ring;
}

/** A drop zone is an area into which one or multiple objects can be dragged and dropped. */
export function DropZone(inProps: DropZoneProps) {
  return untrack(() => dropZone(inProps));
}

function dropZone(inProps: DropZoneProps) {
  const [ctxProps, ref] = contextProps(inProps, inProps.ref, DropZoneContext) as [DropZoneProps, RefValue<HTMLDivElement> | undefined];
  const props = hasLive(ctxProps) ? liveOptions(ctxProps, ["isDisabled"] as never) : ctxProps;
  const isDisabledProp = props.isDisabled;
  const isDisabled = (): boolean => !!read(isDisabledProp);
  const wantsStates = isFn(props.class) || isFn(props.style) || isFn(props.children);
  const states: ZoneStates = wantsStates
    ? { isHovered: signal(false), isFocused: signal(false), isFocusVisible: signal(false), isDropTarget: signal(false) }
    : {};
  const values: DropZoneRenderProps = {
    isHovered: () => !!states.isHovered?.(),
    isFocused: () => !!states.isFocused?.(),
    isFocusVisible: () => !!states.isFocusVisible?.(),
    isDropTarget: () => !!states.isDropTarget?.(),
    isDisabled,
  };
  const { onDrop, onDropEnter, onDropExit, onDropMove, onDropActivate, getDropOperation, onHoverStart, onHoverEnd, onHoverChange } = props;
  const drop: DropHandlerOptions = {
    onDrop,
    onDropEnter,
    onDropExit,
    onDropMove,
    onDropActivate,
    getDropOperation,
    setDropTarget: (el, value) => (setDataAttr(el, "data-drop-target", value), states.isDropTarget?.set(value)),
  };
  const hover: InteractionStateOptions = {
    onHoverStart,
    onHoverEnd,
    onHoverChange,
    states: wantsStates ? { isHovered: states.isHovered } : undefined,
  };
  const rp = renderPropsOf(props, { values, defaultClassName: "rv-DropZone" });
  const locale = useLocale().locale;
  const buttonId = createId();
  const textId = createId();
  const ariaLabel = props["aria-label"] || formatMessage(strings, locale, "dropzoneLabel");
  const labelledBy = [buttonId, textId, props["aria-labelledby"]].filter(Boolean).join(" ");
  const slot = props.slot ?? undefined;
  const dom = globalDOMProps(props, OWNED);
  const button = (
    <span style={visuallyHidden}>
      <button
        type="button"
        id={buttonId}
        disabled={isDisabled()}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        onFocusIn={(e: FocusEvent) => {
          const zone = zoneOf(e.currentTarget as Element);
          if (zone) focusRingIn(ringOf(zone, states) as never, e);
        }}
        onFocusOut={(e: FocusEvent) => {
          // focusRingIn binds the button's own blur; focusout is a fallback when the button is removed while focused.
          const zone = zoneOf(e.currentTarget as Element);
          if (zone && getEventTarget(e) === e.currentTarget) focusRingBlur(ringOf(zone, states) as never, e);
        }}
        on:beforepaste={(e: Event) => {
          // Unfortunately `clipboardData.types` is not available here: always enable the Paste menu item.
          if (!isDisabled() && onDrop) e.preventDefault();
        }}
        onPaste={(e: ClipboardEvent) => {
          if (isDisabled() || !onDrop) return;
          e.preventDefault();
          if (e.clipboardData) onDrop({ type: "drop", items: readFromDataTransfer(e.clipboardData), x: 0, y: 0, dropOperation: "copy" });
        }}
      />
    </span>
  );
  const handlers = {
    onPointerOver: (e: PointerEvent) => hoverStateOver(hover, e),
    // A press on a non-focusable part of the zone focuses the hidden button (RAC: `onClick`; here the primary pointer's
    // `pointerup`, so the non-focusable zone carries no click handler for the dev a11y check).
    onPointerUp: (e: PointerEvent) => {
      if (e.button !== 0 || !e.isPrimary) return;
      const zone = e.currentTarget as HTMLElement;
      let target = getEventTarget(e) as HTMLElement | null;
      while (target && nodeContains(zone, target)) {
        if (isFocusable(target)) break;
        else if (target === zone) {
          const hidden = zone.querySelector<HTMLButtonElement>(":scope > span > button");
          if (hidden) focusWithoutScrolling(hidden);
          break;
        }
        target = target.parentElement;
      }
    },
    onDragEnter: (e: DragEvent) => {
      if (!isDisabled()) dropDragEnter(drop, e);
    },
    onDragOver: (e: DragEvent) => {
      if (!isDisabled()) dropDragOver(drop, e);
    },
    onDragLeave: (e: DragEvent) => {
      if (!isDisabled()) dropDragLeave(drop, e);
    },
    onDrop: (e: DragEvent) => {
      if (!isDisabled()) dropDrop(drop, e);
    },
  };
  const attrs = { ...dom, ...handlers };
  const children = (
    <Provider token={TextContext} value={{ id: textId, slot: "label" }}>
      {button}
      {rp.children()}
    </Provider>
  );
  if (props.render)
    return props.render(
      {
        ...attrs,
        id: props.id,
        ref: ref as never,
        slot,
        class: () => rp.class(),
        style: () => rp.style(),
        "data-disabled": () => (isDisabled() ? "true" : undefined),
        children,
      } as never,
      values,
    );
  return (
    // The handlers go through the spread: a spread listener's type joins the resume loader's delegated types (`dragenter`
    // etc. are not default ones), so a cold drag wakes the page.
    <div {...attrs} id={props.id} ref={ref as never} slot={slot} class={rp.class()} style={rp.style()} data-disabled={isDisabled() ? "true" : undefined}>
      {children}
    </div>
  );
}
