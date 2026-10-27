// Ported from react-aria (packages/react-aria/src/toast/useToast.ts, useToastRegion.ts), Apache-2.0, © Adobe.
// Rivet:
// - `useToastRegion(props, state, ref)` → `toastRegionProps(props, state, ref)` returning RA's `regionProps`
//   bag; `useToast(props, state, ref)` → `toastProps(props, state)` returning RA's
//   `{ toastProps, contentProps, titleProps, descriptionProps, closeButtonProps }`.
// - Toasts and their region only ever render in the browser (RA renders nothing during SSR; on a resumed
//   page the region appears with the first toast), so both bags carry plain handler closures and their
//   effects run in the calling owner: RA's layout effects / effects → `effect` / `queueMicrotask`
//   (after the toast list rendered), unmount cleanups → `onCleanup`. Custom markup calls them while
//   rendering in the browser, like the components in `./index.tsx`.
// - `state.visibleToasts` is a signal accessor (`createToastQueueState`); `ref` is a `ref()`; reactive
//   attribute values (`aria-label`, `aria-hidden`, `aria-describedby`) are accessors.
// - useToast's `[timer, timeout]` effect: re-checked whenever `state.visibleToasts()` changes (a queue that swaps a toast's
//   timer in place, e.g. HeroUI's exit-aware queue `update()`, notifies; the toast's countdown restarts on the new timer).
// - React `onFocus` / `onBlur` (bubbling) → `onFocusIn` / `onFocusOut`, merged with useFocusWithin's.
// Deviation:
// - The region ignores the focusout Chromium fires when the focused toast is removed (jsdom fires none),
//   so focus still moves to the next toast / back to the trigger as upstream's tests expect.
import { effect, onCleanup, signal, untrack } from "@rivetjs/reactivity";
import type { Ref } from "@rivetjs/runtime/jsx-runtime";
import { formatMessage } from "../_adapters/intl.ts";
import { getInteractionModality } from "../interactions/focus-visible.tsx";
import { focusWithinBlur, focusWithinFocus } from "../interactions/focus.tsx";
import { hoverProps } from "../interactions/hover.tsx";
import { mergeProps } from "../interactions/merge-props.tsx";
import { landmarkProps } from "../landmark/index.tsx";
import { getEventTarget, getOwnerDocument } from "../utils/dom-core.ts";
import { resumedId } from "../utils/id.ts";
import { focusWithoutScrolling } from "../utils/index.ts";
import type { QueuedToast, ToastState } from "../state/toast.ts";
import { strings as intlMessages } from "./intl.ts";

type FocusableElement = HTMLElement | SVGElement;
type DOMAttributes = Record<string, unknown>;

export interface AriaLabelingProps {
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-details"?: string;
}

export interface AriaToastRegionProps extends AriaLabelingProps {
  /**
   * An accessibility label for the toast region.
   * @default 'Notifications'
   */
  "aria-label"?: string;
}

export interface AriaToastProps<T> extends AriaLabelingProps {
  /** The toast object. */
  toast: QueuedToast<T>;
  /** Rivet: locale of the strings (RA reads the I18nProvider). @default "en-US" */
  locale?: string;
}

export interface ToastAria {
  /** Props for the toast container, non-modal dialog element. */
  toastProps: DOMAttributes;
  /** Props for the toast content alert message. */
  contentProps: DOMAttributes;
  /** Props for the toast title element. */
  titleProps: DOMAttributes;
  /** Props for the toast description element, if any. */
  descriptionProps: DOMAttributes;
  /** Props for the toast close button. */
  closeButtonProps: { "aria-label": string; onPress: () => void };
}

const isBrowser = (): boolean => typeof document !== "undefined";

// RA `filterDOMProps(props, { labelable: true })`: id, data-*, aria labelling.
function labelableDOMProps(props: Record<string, unknown>): DOMAttributes {
  const out: DOMAttributes = {};
  for (const key in props) {
    if (key === "id" || key === "aria-label" || key === "aria-labelledby" || key === "aria-describedby" || key === "aria-details" || key.startsWith("data-")) {
      out[key] = props[key];
    }
  }
  return out;
}

/**
 * Provides the behavior and accessibility implementation for a toast component. Toasts display
 * brief, temporary notifications of actions, errors, or other events in an application.
 */
export function toastProps<T>(props: AriaToastProps<T>, state: Pick<ToastState<T>, "close"> & Partial<Pick<ToastState<T>, "visibleToasts">>): ToastAria {
  const toast = props.toast;
  const key = toast.key;

  // RA useEffect([timer, timeout]): (re)start the countdown when shown or when the toast's timer / timeout changes (a queue
  // that replaces them in place notifies its subscribers: `visibleToasts()` re-runs this), pause it when removed.
  if (isBrowser()) {
    let current: { timer: QueuedToast<T>["timer"]; timeout: number | undefined } | undefined;
    const sync = () => {
      const { timer, timeout } = toast;
      if (current && current.timer === timer && current.timeout === timeout) return;
      current?.timer?.pause();
      current = { timer, timeout };
      if (timer != null && timeout != null) timer.reset(timeout);
    };
    if (state.visibleToasts) {
      const visibleToasts = state.visibleToasts;
      effect(() => {
        visibleToasts();
        untrack(sync);
      });
    } else sync();
    onCleanup(() => current?.timer?.pause());
  }

  const titleId = resumedId();
  const descriptionId = resumedId();
  // RA useSlotId: the description id only once an element with it rendered.
  const descriptionSlot = signal<string | undefined>(undefined);

  // This is required for NVDA announcements, without it NVDA will NOT announce the toast when it appears.
  const isVisible = signal(false);
  if (isBrowser()) {
    let live = true;
    onCleanup(() => (live = false));
    queueMicrotask(() => {
      if (!live) return;
      isVisible.set(true);
      if (getOwnerDocument().getElementById(descriptionId)) descriptionSlot.set(descriptionId);
    });
  }

  const labelable = labelableDOMProps(props as unknown as Record<string, unknown>);
  const ariaDescribedby = props["aria-describedby"];

  return {
    toastProps: {
      ...labelable,
      role: "alertdialog",
      "aria-modal": "false",
      "aria-labelledby": props["aria-labelledby"] || titleId,
      "aria-describedby": ariaDescribedby ? ariaDescribedby : () => descriptionSlot(),
      tabIndex: 0,
    },
    contentProps: {
      role: "alert",
      "aria-atomic": "true",
      "aria-hidden": () => (isVisible() ? undefined : "true"),
    },
    titleProps: { id: titleId },
    descriptionProps: { id: descriptionId },
    closeButtonProps: {
      "aria-label": formatMessage(intlMessages, props.locale, "close"),
      onPress: () => state.close(key),
    },
  };
}

/**
 * Provides the behavior and accessibility implementation for a toast region containing one or more
 * toasts. Toasts display brief, temporary notifications of actions, errors, or other events in an
 * application. Returns RA's `regionProps`.
 */
export function toastRegionProps<T>(
  props: AriaToastRegionProps & { locale?: string },
  state: ToastState<T>,
  ref: Ref<HTMLElement> | (() => HTMLElement | null | undefined),
): DOMAttributes {
  const locale = props.locale;
  const ariaLabel = props["aria-label"];
  const landmark = landmarkProps(
    {
      role: "region",
      "aria-label": () => ariaLabel || formatMessage(intlMessages, locale, "notifications", { count: state.visibleToasts().length }),
    },
    ref as () => HTMLElement | null | undefined,
  );

  const local = { isHovered: false, isFocused: false };
  const updateTimers = () => {
    if (local.isHovered || local.isFocused) state.pauseAll();
    else state.resumeAll();
  };

  const hover = hoverProps({
    onHoverStart: () => {
      local.isHovered = true;
      updateTimers();
    },
    onHoverEnd: () => {
      local.isHovered = false;
      updateTimers();
    },
  });

  // Manage focus within the toast region.
  // If a focused containing toast is removed, move focus to the next toast, or the previous toast if there is no next toast.
  let toasts: FocusableElement[] = [];
  let prevVisibleToasts = untrack(state.visibleToasts);
  let focusedToast: number | null = null;
  let lastFocused: FocusableElement | null = null;

  const layoutEffect = (visibleToasts: QueuedToast<T>[]) => {
    const element = ref();
    // If no toast has focus, then don't do anything.
    if (focusedToast === -1 || visibleToasts.length === 0 || !element) {
      toasts = [];
      prevVisibleToasts = visibleToasts;
      return;
    }
    toasts = [...element.querySelectorAll('[role="alertdialog"]')] as FocusableElement[];
    // If the visible toasts haven't changed, we don't need to do anything.
    if (prevVisibleToasts.length === visibleToasts.length && visibleToasts.every((t, i) => t.key === prevVisibleToasts[i]!.key)) {
      prevVisibleToasts = visibleToasts;
      return;
    }
    // Get a list of all toasts by index and add info if they are removed.
    const allToasts = prevVisibleToasts.map((t, i) => ({ ...t, i, isRemoved: !visibleToasts.some((t2) => t.key === t2.key) }));

    const removedFocusedToastIndex = allToasts.findIndex((t) => t.i === focusedToast && t.isRemoved);

    // If the focused toast was removed, focus the next or previous toast.
    if (removedFocusedToastIndex > -1) {
      // In pointer modality, move focus out of the toast region.
      // Otherwise auto-dismiss timers will appear "stuck".
      if (getInteractionModality() === "pointer" && lastFocused?.isConnected) {
        focusWithoutScrolling(lastFocused);
      } else {
        let i = 0;
        let nextToast: number | undefined;
        let prevToast: number | undefined;
        while (i <= removedFocusedToastIndex) {
          if (!allToasts[i]!.isRemoved) prevToast = Math.max(0, i - 1);
          i++;
        }
        while (i < allToasts.length) {
          if (!allToasts[i]!.isRemoved) {
            nextToast = i - 1;
            break;
          }
          i++;
        }

        // in the case where it's one toast at a time, both will be undefined, but we know the index must be 0
        if (prevToast === undefined && nextToast === undefined) prevToast = 0;

        // prioritize going to newer toasts
        if (prevToast! >= 0 && prevToast! < toasts.length) focusWithoutScrolling(toasts[prevToast!]!);
        else if (nextToast! >= 0 && nextToast! < toasts.length) focusWithoutScrolling(toasts[nextToast!]!);
      }
    }

    prevVisibleToasts = visibleToasts;
  };

  // When the number of visible toasts becomes 0 or the region unmounts,
  // restore focus to the last element that had focus before the user moved focus
  // into the region. FocusScope restore focus doesn't update whenever the focus
  // moves in, it only happens once, so we correct it.
  const restoreFocus = () => {
    if (lastFocused?.isConnected) {
      if (getInteractionModality() === "pointer") focusWithoutScrolling(lastFocused);
      else lastFocused.focus();
      lastFocused = null;
    }
  };

  if (isBrowser()) {
    let live = true;
    onCleanup(() => {
      live = false;
      restoreFocus();
    });
    // RA useLayoutEffect / useEffect on visibleToasts: run after the toast list rendered.
    effect(() => {
      const visibleToasts = state.visibleToasts();
      queueMicrotask(() => {
        if (!live) return;
        layoutEffect(visibleToasts);
        if (visibleToasts.length === 0) restoreFocus();
      });
    });
  }

  const within = {
    props: {
      onFocusWithin: (e: FocusEvent) => {
        local.isFocused = true;
        lastFocused = e.relatedTarget as FocusableElement;
        updateTimers();
      },
      onBlurWithin: () => {
        local.isFocused = false;
        lastFocused = null;
        updateTimers();
      },
    },
    state: { isFocusWithin: false, globals: [] as (() => void)[] },
  };

  return mergeProps(landmark, hover.hoverProps, {
    tabIndex: -1,
    // Mark the toast region as a "top layer", so that it:
    //   - is not aria-hidden when opening an overlay
    //   - allows focus even outside a containing focus scope
    //   - doesn't dismiss overlays when clicking on it, even though it is outside
    "data-react-aria-top-layer": true,
    // listen to focus events separate from focuswithin because that will only fire once
    // and we need to follow all focus changes
    onFocusIn: (e: FocusEvent) => {
      focusWithinFocus(within, e);
      const target = (getEventTarget(e) as Element).closest('[role="alertdialog"]');
      focusedToast = toasts.findIndex((t) => t === target);
    },
    onFocusOut: (e: FocusEvent) => {
      // Deviation: Chromium fires focusout when the focused toast is removed from the DOM (jsdom, which
      // upstream tests run in, does not). Ignore that one, so the focus-management effect still sees the
      // removed toast's index and the element focus came from; the state already dropped the toast.
      if (focusedToast !== null && focusedToast >= 0 && e.relatedTarget == null) {
        const key = prevVisibleToasts[focusedToast]?.key;
        if (key !== undefined && !untrack(state.visibleToasts).some((t) => t.key === key)) return;
      }
      focusWithinBlur(within, e);
      focusedToast = -1;
    },
  });
}
