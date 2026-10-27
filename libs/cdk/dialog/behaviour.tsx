// Ported from packages/react-aria/src/dialog/useDialog.ts, Apache-2.0, © Adobe.
// Rivet:
// - `useDialog(props, ref)` → `dialogProps(props, slots?)` (attribute bags, server-safe, call during
//   render) + `dialogFocus(element, isEntering)` (the mount effect: call from a client effect, returns
//   the cleanup) + `dialogBlur(event)` (the dialog's `onBlur`) + `dialogTitleWarning(element)` (dev).
// - `useSlotId()` → the caller passes slot ids (`{ id, rendered }`, `createSlotId()` of `slots/`) read with
//   `slotIdRef` inside the attribute bindings (server: the id is kept, RA's server HTML); without them the ids
//   are kept (React's first render does the same).
// - `useOverlayFocusContain()` → the surrounding `<Overlay>` (`portal/`) contains focus.
// - `isRefocusing` ref → a WeakSet of dialog elements being re-focused (handlers are free functions).
import { resumedId } from "../utils/id.ts";
import { slotIdRef, type SlotId } from "../slots/index.tsx";
import { focusSafely } from "../focus/index.ts";
import { DEV, getActiveElement, isFocusWithin } from "../utils/dom-core.ts";

export interface AriaDialogProps {
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
  /**
   * The accessibility role for the dialog.
   * @default 'dialog'
   */
  role?: "dialog" | "alertdialog";
  /**
   * Whether the dialog is currently performing an entry animation. Focus is not moved into the
   * dialog until the animation completes, since moving the screen reader cursor may cause scrolling
   * that interrupts the animation.
   */
  isEntering?: boolean;
}

/** Slot ids of the title / content parts (RA `useSlotId`); read inside the attribute bindings. */
export interface DialogSlots {
  title?: SlotId;
  content?: SlotId;
}

export interface DialogAria {
  /** Props for the dialog container element. */
  dialogProps: {
    id?: string;
    role: "dialog" | "alertdialog";
    tabIndex: -1;
    "aria-label"?: string;
    "aria-labelledby": () => string | undefined;
    "aria-describedby": () => string | undefined;
    "aria-details"?: string;
  };
  /** Props for the dialog title element. */
  titleProps: { id: string | undefined };
  /** Props for the dialog content/description element. Used for aria-describedby on alertdialogs. */
  contentProps: { id: string | undefined };
}

/** Attribute bags of a dialog and its title / description (react-aria `useDialog`). */
export function dialogProps(props: AriaDialogProps, slots: DialogSlots = {}): DialogAria {
  const role = props.role ?? "dialog";
  let titleId: string | undefined = slots.title?.id ?? resumedId();
  titleId = props["aria-label"] ? undefined : titleId;

  let contentId: string | undefined = slots.content?.id ?? resumedId();
  contentId = role === "alertdialog" && !props["aria-describedby"] ? contentId : undefined;

  const title = slots.title,
    content = slots.content;
  const labelledBy = props["aria-labelledby"],
    describedBy = props["aria-describedby"];
  // We do not use aria-modal due to a Safari bug which forces the first focusable element to be focused
  // on mount when inside an iframe, no matter which element we programmatically focus.
  // See https://bugs.webkit.org/show_bug.cgi?id=211934.
  // useModal sets aria-hidden on all elements outside the dialog, so the dialog will behave as a modal
  // even without aria-modal on the dialog itself.
  return {
    dialogProps: {
      id: props.id,
      "aria-label": props["aria-label"],
      "aria-details": props["aria-details"],
      role,
      tabIndex: -1,
      // The slot id in use (the part's own `id` prop when it has one: RA mergeIds), else the generated id.
      "aria-labelledby": () => labelledBy ?? (titleId ? (title ? slotIdRef(title) : titleId) : undefined),
      "aria-describedby": () => describedBy ?? (contentId ? (content ? slotIdRef(content, false) : contentId) : undefined),
    },
    titleProps: { id: titleId },
    contentProps: { id: contentId },
  };
}

/** Dialog elements currently being blurred and re-focused (iOS VoiceOver workaround). */
const refocusing = new WeakSet<Element>();

/**
 * The dialog's mount effect: focus the dialog itself on mount (or once it has entered), unless a child
 * element is already focused. Returns the cleanup (call from a client effect).
 */
export function dialogFocus(element: HTMLElement | null | undefined, isEntering?: boolean): (() => void) | undefined {
  if (isEntering || !element || isFocusWithin(element)) return;
  focusSafely(element);

  // Safari on iOS does not move the VoiceOver cursor to the dialog
  // or announce that it has opened until it has rendered. A workaround
  // is to wait for half a second, then blur and re-focus the dialog.
  const timeout = setTimeout(() => {
    // Check that the dialog is still focused, or focused was lost to the body.
    const active = getActiveElement(element.ownerDocument);
    if (active === element || active === element.ownerDocument.body) {
      refocusing.add(element);
      element.blur();
      focusSafely(element);
      refocusing.delete(element);
    }
  }, 500);

  return () => clearTimeout(timeout);
}

/**
 * The dialog's `onBlur`: prevent blur events from reaching useOverlay, which may cause popovers to
 * close. Since focus is contained within the dialog, we don't want this to occur due to the refocus in
 * `dialogFocus`.
 */
export function dialogBlur(event: FocusEvent): void {
  if (refocusing.has(event.currentTarget as Element)) event.stopPropagation();
}

/**
 * Warn in dev mode if the dialog has no accessible title (call from a client effect). Checks the DOM
 * element directly since aria-labelledby may be added by wrapper components (e.g. the RAC Dialog uses
 * the trigger id as a fallback).
 */
export function dialogTitleWarning(element: HTMLElement | null | undefined): void {
  if (!DEV || !element) return;
  if (!element.hasAttribute("aria-label") && !element.hasAttribute("aria-labelledby")) {
    console.warn(
      "A dialog must have a title for accessibility. " + "Either provide an aria-label or aria-labelledby prop, or render a heading element inside the dialog.",
    );
  }
}
