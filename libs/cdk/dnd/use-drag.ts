// Ported from react-spectrum (packages/react-aria/src/dnd/useDrag.ts), Apache-2.0, © Adobe.
// Handles drag interactions for an element: native HTML5 drag and drop, plus the keyboard / screen reader drag session
// (`./drag-manager.ts`).
// Rivet:
// - Called once in a component body (no re-render): `options` functions are read at event time; `isDragging` is an
//   accessor; `dragProps` handlers take the DOM event; `dragButtonProps` are cdk `Button` props (`onPress`, accessor
//   `aria-describedby`).
// - `useDescription` → `aria-describedby` accessor over `descriptionId` (browser only: the server renders none, as
//   react-aria's SSR output).
// - `useGlobalListeners` → a local listener list; the unmount check (a dragged element removed by its own drop) runs
//   from the owner's cleanup.
import { getOwner, onCleanup, signal } from "@rivetjs/reactivity";
import { formatMessage } from "../_adapters/intl.ts";
import { useLocale } from "../i18n/index.ts";
import { isIOS, isVirtualClick, isVirtualPointerEvent, isWebKit } from "../platform/index.ts";
import { getEventTarget } from "../utils/dom-core.ts";
import * as DragManager from "./drag-manager.ts";
import { DROP_EFFECT_TO_DROP_OPERATION, DROP_OPERATION, EFFECT_ALLOWED } from "./constants.ts";
import { strings } from "./intl.ts";
import type { DragEndEvent, DragItem, DragMoveEvent, DragPreviewRenderer, DragStartEvent, DropOperation } from "./types.ts";
import { descriptionId, globalDropEffect, setGlobalAllowedDropOperations, setGlobalDropEffect, useDragModality, writeToDataTransfer } from "./utils.ts";

export interface DragOptions {
  /** Handler that is called when a drag operation is started. */
  onDragStart?: ((e: DragStartEvent) => void) | undefined;
  /** Handler that is called when the drag is moved. */
  onDragMove?: ((e: DragMoveEvent) => void) | undefined;
  /** Handler that is called when the drag operation is ended, either as a result of a drop or a cancellation. */
  onDragEnd?: ((e: DragEndEvent) => void) | undefined;
  /** A function that returns the items being dragged. */
  getItems: () => DragItem[];
  /** The ref of the element that will be rendered as the drag preview while dragging. */
  preview?: { readonly current: DragPreviewRenderer | null } | undefined;
  /** Function that returns the drop operations that are allowed for the dragged items. If not provided, all drop operations are allowed. */
  getAllowedDropOperations?: (() => DropOperation[]) | undefined;
  /**
   * Whether the item has an explicit focusable drag affordance to initiate accessible drag and drop mode. If true, the
   * dragProps will omit these event handlers, and they will be applied to dragButtonProps instead.
   */
  hasDragButton?: boolean | undefined;
  /** Whether the drag operation is disabled. If true, the element will not be draggable. */
  isDisabled?: boolean | undefined;
  /** Rivet: the locale of the messages (default: the nearest `I18nProvider` / environment). */
  locale?: string | undefined;
}

/** Props of the draggable element (attribute values and DOM event handlers). */
export interface DragProps {
  draggable?: "true" | "false" | undefined;
  "aria-describedby"?: (() => string | undefined) | undefined;
  onDragStart?: ((e: DragEvent) => void) | undefined;
  onDrag?: ((e: DragEvent) => void) | undefined;
  onDragEnd?: ((e: DragEvent) => void) | undefined;
  onPointerDown?: ((e: PointerEvent) => void) | undefined;
  onKeyDownCapture?: ((e: KeyboardEvent) => void) | undefined;
  onKeyUpCapture?: ((e: KeyboardEvent) => void) | undefined;
  onClick?: ((e: MouseEvent) => void) | undefined;
}

/** Props of the drag button (cdk `Button` props). */
export interface DragButtonProps {
  onPress?: ((e: { pointerType: string; target: Element }) => void) | undefined;
  "aria-describedby"?: (() => string | undefined) | undefined;
  isDisabled?: boolean | (() => boolean) | undefined;
  "aria-label"?: string | (() => string | undefined) | undefined;
}

export interface DragResult {
  /** Props for the draggable element. */
  dragProps: DragProps;
  /** Props for the explicit drag button affordance, if any. */
  dragButtonProps: DragButtonProps;
  /** Whether the element is currently being dragged. */
  isDragging: () => boolean;
}

const MESSAGES = {
  keyboard: { start: "dragDescriptionKeyboard", end: "endDragKeyboard" },
  touch: { start: "dragDescriptionTouch", end: "endDragTouch" },
  virtual: { start: "dragDescriptionVirtual", end: "endDragVirtual" },
};

/** The dnd messages formatter for a locale (react-aria `useLocalizedStringFormatter(intlMessages, '@react-aria/dnd')`). */
export function dndFormatter(locale?: string): DragManager.DragFormat {
  const l = locale ?? useLocale().locale;
  return (key, args) => formatMessage(strings, l, key, args);
}

/**
 * Handles drag interactions for an element, with support for traditional mouse and touch based drag and drop, in
 * addition to full parity for keyboard and screen reader users.
 */
export function useDrag(options: DragOptions): DragResult {
  const { hasDragButton, isDisabled } = options;
  const stringFormatter = dndFormatter(options.locale);
  const state = { options, x: 0, y: 0 };
  let isDraggingElement: Element | null = null;
  const isDragging = signal(false);
  const setDragging = (element: Element | null) => {
    isDraggingElement = element;
    isDragging.set(!!element);
  };
  const globalListeners: Array<() => void> = [];
  const removeAllGlobalListeners = () => {
    for (const remove of globalListeners.splice(0)) remove();
  };
  let modalityOnPointerDown: string | null = null;

  const onDragStart = (e: DragEvent) => {
    if (e.defaultPrevented) return;
    // Prevent the drag event from propagating to any parent draggables
    e.stopPropagation();
    // If this drag was initiated by a mobile screen reader (e.g. VoiceOver or TalkBack), enter virtual dragging mode.
    if (modalityOnPointerDown === "virtual") {
      e.preventDefault();
      startDragging(getEventTarget(e) as HTMLElement);
      modalityOnPointerDown = null;
      return;
    }
    if (typeof options.onDragStart === "function") options.onDragStart({ type: "dragstart", x: e.clientX, y: e.clientY });
    const items = options.getItems();
    const dataTransfer = e.dataTransfer!;
    // Clear existing data (e.g. selected text on the page would be included in some browsers)
    dataTransfer.clearData?.();
    writeToDataTransfer(dataTransfer, items);
    let allowed: number = DROP_OPERATION.all;
    if (typeof options.getAllowedDropOperations === "function") {
      const allowedOperations = options.getAllowedDropOperations();
      allowed = DROP_OPERATION.none;
      for (const operation of allowedOperations) allowed |= DROP_OPERATION[operation] || DROP_OPERATION.none;
    }
    setGlobalAllowedDropOperations(allowed);
    const effectAllowed = EFFECT_ALLOWED[allowed] || "none";
    dataTransfer.effectAllowed = effectAllowed === "cancel" ? "none" : effectAllowed;
    // If there is a preview option, use it to render a custom preview image that will appear under the pointer while
    // dragging. If not, the element itself is dragged by the browser.
    const currentTarget = e.currentTarget as HTMLElement;
    if (typeof options.preview?.current === "function") {
      options.preview.current(items, (node, userX, userY) => {
        if (!node) return;
        // Compute the offset that the preview will appear under the mouse. If possible, this is based on the point the
        // user clicked on the target. If the preview is much smaller, then just use the center point of the preview.
        const size = node.getBoundingClientRect();
        const rect = currentTarget.getBoundingClientRect();
        let defaultX = e.clientX - rect.x;
        let defaultY = e.clientY - rect.y;
        if (defaultX > size.width || defaultY > size.height) {
          defaultX = size.width / 2;
          defaultY = size.height / 2;
        }
        // Start with default offsets; if the preview renderer supplied explicit offsets, use those.
        let offsetX = defaultX;
        let offsetY = defaultY;
        if (typeof userX === "number" && typeof userY === "number") {
          offsetX = userX;
          offsetY = userY;
        }
        // Clamp the offset so it stays within the preview bounds. Browsers automatically clamp out-of-range values, but
        // doing it ourselves prevents the visible "snap" that can occur when the browser adjusts them after the first
        // drag update.
        offsetX = Math.max(0, Math.min(offsetX, size.width));
        offsetY = Math.max(0, Math.min(offsetY, size.height));
        // Rounding height to an even number prevents blurry preview seen on some screens
        const height = 2 * Math.round(size.height / 2);
        node.style.height = `${height}px`;
        dataTransfer.setDragImage(node, offsetX, offsetY);
      });
    }
    // Enforce that drops are handled by useDrop.
    const onWindowDrop = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      console.warn(
        "Drags initiated from the React Aria useDrag hook may only be dropped on a target created with useDrop. This ensures that a keyboard and screen reader accessible alternative is available.",
      );
    };
    window.addEventListener("drop", onWindowDrop, { once: true });
    globalListeners.push(() => window.removeEventListener("drop", onWindowDrop));
    state.x = e.clientX;
    state.y = e.clientY;
    // Wait a frame before we set dragging to true so that the browser has time to render the preview image before we
    // update the element that has been dragged.
    const target = getEventTarget<Element>(e);
    requestAnimationFrame(() => setDragging(target));
  };

  const onDrag = (e: DragEvent) => {
    // Prevent the drag event from propagating to any parent draggables
    e.stopPropagation();
    if (e.clientX === state.x && e.clientY === state.y) return;
    if (typeof options.onDragMove === "function") options.onDragMove({ type: "dragmove", x: e.clientX, y: e.clientY });
    state.x = e.clientX;
    state.y = e.clientY;
  };

  const onDragEnd = (e: DragEvent) => {
    // Prevent the drag event from propagating to any parent draggables
    e.stopPropagation();
    if (typeof options.onDragEnd === "function") {
      const event: DragEndEvent = { type: "dragend", x: e.clientX, y: e.clientY, dropOperation: DROP_EFFECT_TO_DROP_OPERATION[e.dataTransfer!.dropEffect] };
      // Chrome Android always returns none as its dropEffect so we use the drop effect set in useDrop via
      // onDragEnter/onDragOver instead. https://bugs.chromium.org/p/chromium/issues/detail?id=1353951
      if (globalDropEffect) event.dropOperation = DROP_EFFECT_TO_DROP_OPERATION[globalDropEffect];
      options.onDragEnd(event);
    }
    setDragging(null);
    removeAllGlobalListeners();
    setGlobalAllowedDropOperations(DROP_OPERATION.none);
    setGlobalDropEffect(undefined);
  };

  // If the dragged element is removed from the DOM via onDrop, onDragEnd won't fire:
  // https://bugzilla.mozilla.org/show_bug.cgi?id=460801. In this case, we need to manually call onDragEnd on cleanup.
  if (typeof document !== "undefined" && getOwner())
    onCleanup(() => {
      removeAllGlobalListeners();
      if (isDraggingElement && !isDraggingElement.isConnected) {
        if (typeof state.options.onDragEnd === "function")
          state.options.onDragEnd({ type: "dragend", x: 0, y: 0, dropOperation: DROP_EFFECT_TO_DROP_OPERATION[globalDropEffect || "none"] });
        setDragging(null);
        setGlobalAllowedDropOperations(DROP_OPERATION.none);
        setGlobalDropEffect(undefined);
      }
    });

  const onPress = (e: { pointerType: string; target: Element }) => {
    if (e.pointerType !== "keyboard" && e.pointerType !== "virtual") return;
    startDragging(e.target as HTMLElement);
  };

  const startDragging = (target: HTMLElement) => {
    if (typeof state.options.onDragStart === "function") {
      const rect = target.getBoundingClientRect();
      state.options.onDragStart({ type: "dragstart", x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
    }
    DragManager.beginDragging(
      {
        element: target,
        items: state.options.getItems(),
        allowedDropOperations:
          typeof state.options.getAllowedDropOperations === "function" ? state.options.getAllowedDropOperations() : ["move", "copy", "link"],
        onDragEnd(e) {
          setDragging(null);
          if (typeof state.options.onDragEnd === "function") state.options.onDragEnd(e);
        },
      },
      stringFormatter,
    );
    setDragging(target);
  };

  const modality = useDragModality();
  const describedBy = () => descriptionId(stringFormatter(!isDragging() ? MESSAGES[modality()].start : MESSAGES[modality()].end));

  let interactions: DragProps = {};
  if (!hasDragButton) {
    // If there's no separate button to trigger accessible drag and drop mode, then add event handlers to the draggable
    // element itself to start dragging. For keyboard, we use the Enter key in a capturing listener to prevent other
    // events such as selection from also occurring. We attempt to infer whether a pointer event (e.g. long press) came
    // from a touch screen reader, and then initiate dragging in the native onDragStart listener above.
    interactions = {
      "aria-describedby": describedBy,
      onPointerDown(e) {
        modalityOnPointerDown = isVirtualPointerEvent(e) ? "virtual" : e.pointerType;
        // Try to detect virtual drag passthrough gestures.
        if (e.width < 1 && e.height < 1 && isIOS() && isWebKit()) {
          // iOS VoiceOver.
          modalityOnPointerDown = "virtual";
        } else {
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          const offsetX = e.clientX - rect.x;
          const offsetY = e.clientY - rect.y;
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          // Android TalkBack.
          if (Math.abs(offsetX - centerX) <= 0.5 && Math.abs(offsetY - centerY) <= 0.5) modalityOnPointerDown = "virtual";
          else modalityOnPointerDown = e.pointerType;
        }
      },
      onKeyDownCapture(e) {
        if (getEventTarget(e) === e.currentTarget && e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
        }
      },
      onKeyUpCapture(e) {
        if (getEventTarget(e) === e.currentTarget && e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          startDragging(getEventTarget(e) as HTMLElement);
        }
      },
      onClick(e) {
        // Handle NVDA/JAWS in browse mode, and touch screen readers. In this case, no keyboard events are fired.
        if (isVirtualClick(e) || modalityOnPointerDown === "virtual") {
          e.preventDefault();
          e.stopPropagation();
          startDragging(getEventTarget(e) as HTMLElement);
        }
      },
    };
  }

  if (isDisabled) return { dragProps: { draggable: "false" }, dragButtonProps: {}, isDragging: () => false };

  return {
    dragProps: { ...interactions, draggable: "true", onDragStart, onDrag, onDragEnd },
    dragButtonProps: { "aria-describedby": describedBy, onPress },
    isDragging: () => isDragging(),
  };
}
