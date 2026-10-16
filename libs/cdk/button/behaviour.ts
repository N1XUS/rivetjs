// Ported from react-aria `useButton` (packages/react-aria/src/button/useButton.ts) and the RAC Button's
// `useDisableInteractions` (packages/react-aria-components/src/Button.tsx), Apache-2.0, © Adobe.
// Rivet (naming convention): `useButton(props, ref)` → `buttonProps(props)` (the attribute bag); the press
// handlers are free functions `button<Event>(event, options, isPending)` called from inline arrows (resumable)
// over THE press port (press.ts → ../interactions/press.tsx). `isPressed` is not returned: the handlers write
// `data-pressed` on the element (zero-cost state, see press.ts).
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import type { AriaLabelingProps, FocusableDOMProps, FocusableProps, PressEvents } from "../utils/types.ts";
import { pressClick, pressDragStart, pressKeyDown, pressMouseDown, pressPointerDown, pressPointerUp, type PressOptions } from "./press.ts";

export type { PressEvent, PressEvents, PressOptions, PointerType } from "./press.ts";

/** RA `ButtonProps` (button/useButton). */
export interface AriaButtonBaseProps extends PressEvents, FocusableProps {
  /** Whether the button is disabled (Rivet: may be an accessor; `buttonProps` reads it once, bind it yourself to react). */
  isDisabled?: MaybeAccessor<boolean | undefined>;
}

/** RA `AriaBaseButtonProps`. */
// Rivet (accessor rule): the state-dependent aria props may be accessors (`aria-label={() => (open() ? "Collapse" : "Expand")}`);
// `buttonProps` keeps them as accessors — read them in attribute bindings.
export interface AriaBaseButtonProps extends FocusableDOMProps, Omit<AriaLabelingProps, "aria-label" | "aria-labelledby"> {
  "aria-label"?: MaybeAccessor<string | undefined>;
  "aria-labelledby"?: MaybeAccessor<string | undefined>;
  "aria-disabled"?: MaybeAccessor<boolean | "true" | "false" | undefined>;
  "aria-expanded"?: MaybeAccessor<boolean | "true" | "false" | undefined>;
  "aria-haspopup"?: MaybeAccessor<boolean | "menu" | "listbox" | "tree" | "grid" | "dialog" | "true" | "false" | undefined>;
  "aria-controls"?: MaybeAccessor<string | undefined>;
  "aria-pressed"?: MaybeAccessor<boolean | "true" | "false" | "mixed" | undefined>;
  "aria-current"?: MaybeAccessor<boolean | "true" | "false" | "page" | "step" | "location" | "date" | "time" | undefined>;
  /** @default "button" (live: a value-form `type={t()}` updates the attribute in place) */
  type?: "button" | "submit" | "reset";
  /** Whether to prevent focus from moving to the button when pressing it. Read once at mount (press option). */
  preventFocusOnPress?: boolean;
  /** @private RA (undocumented, NumberField steppers): a disabled button gets `tabIndex=-1`. */
  allowFocusWhenDisabled?: boolean;
  form?: string;
  formAction?: string;
  formEncType?: string;
  formMethod?: string;
  formNoValidate?: boolean;
  formTarget?: string;
  name?: string;
  value?: string;
}

/** RA `AriaButtonProps` (+ `elementType` / link props for non-`<button>` elements). */
export interface AriaButtonProps extends AriaButtonBaseProps, AriaBaseButtonProps {
  /** The element's unique identifier. Read once at mount (the pending progress bar id derives from it). */
  id?: string;
  /** `button` (default) or another element given `role="button"`. Read once at mount (element choice). */
  elementType?: "button" | "a" | "div" | "span" | "input";
  href?: string;
  target?: string;
  rel?: string;
}

// Accessors (context-provided `aria-expanded={() => state.isOpen()}`) stay accessors: read them in bindings.
const str = (v: unknown): unknown => (typeof v === "function" ? v : v == null ? undefined : String(v));

/**
 * RA `useButton` attributes (without handlers: wire `buttonPointerDown` / `buttonKeyDown` / `buttonClick` /
 * … as inline arrows). Includes `useFocusable` attributes (`tabIndex` for `excludeFromTabOrder`,
 * `autoFocus`) and the labelable DOM props (`id`, `aria-label*`, `aria-describedby`, `aria-details`).
 */
export function buttonProps(props: AriaButtonProps): Record<string, unknown> {
  const { elementType = "button", type = "button" } = props;
  const isDisabled = read(props.isDisabled);
  const out: Record<string, unknown> =
    elementType === "button"
      ? {
          type,
          disabled: isDisabled || undefined,
          form: props.form,
          formAction: props.formAction,
          formEncType: props.formEncType,
          formMethod: props.formMethod,
          formNoValidate: props.formNoValidate,
          formTarget: props.formTarget,
          name: props.name,
          value: props.value,
        }
      : {
          role: "button",
          // RA useFocusable: non-native elements are focusable unless disabled.
          tabIndex: isDisabled ? undefined : 0,
          href: elementType === "a" && !isDisabled ? props.href : undefined,
          target: elementType === "a" ? props.target : undefined,
          type: elementType === "input" ? type : undefined,
          disabled: elementType === "input" ? isDisabled || undefined : undefined,
          "aria-disabled": !isDisabled || elementType === "input" ? undefined : "true",
          rel: elementType === "a" ? props.rel : undefined,
        };
  if (props.allowFocusWhenDisabled && isDisabled) out.tabIndex = -1;
  if (props.excludeFromTabOrder) out.tabIndex = -1;
  if (props.autoFocus) out.autoFocus = true;
  out.id = props.id;
  out["aria-label"] = props["aria-label"];
  out["aria-labelledby"] = props["aria-labelledby"];
  out["aria-describedby"] = props["aria-describedby"];
  out["aria-details"] = props["aria-details"];
  out["aria-haspopup"] = str(props["aria-haspopup"]);
  out["aria-expanded"] = str(props["aria-expanded"]);
  out["aria-controls"] = props["aria-controls"];
  out["aria-pressed"] = str(props["aria-pressed"]);
  out["aria-current"] = str(props["aria-current"]);
  out["aria-disabled"] = str(props["aria-disabled"]) ?? out["aria-disabled"];
  return out;
}

type Pending = MaybeAccessor<boolean | undefined> | undefined;

/** Press options with `isPending` (RAC `useDisableInteractions`: pending buttons ignore presses, keep focus / hover). */
export function pendingOptions(options: PressOptions, isPending: Pending): PressOptions {
  return isPending !== undefined && read(isPending) ? { ...options, isDisabled: true } : options;
}

/** Whether `isPending` is set and true now. */
export const isPendingNow = (isPending: Pending): boolean => isPending !== undefined && !!read(isPending);

// RAC `useDisableInteractions`: while pending the press handlers are removed (not merely disabled: a disabled
// usePress prevents the pointerdown default, which would keep the pending button from taking focus).
export const buttonKeyDown = (e: KeyboardEvent, o: PressOptions, pending?: Pending): void => {
  if (!isPendingNow(pending)) pressKeyDown(o, e);
};
export const buttonClick = (e: MouseEvent, o: PressOptions, pending?: Pending): void => {
  // Pending submit buttons render `type="button"`; other pending clicks are swallowed.
  if (isPendingNow(pending)) e.preventDefault();
  else pressClick(o, e);
};
export const buttonPointerDown = (e: PointerEvent, o: PressOptions, pending?: Pending): void => {
  if (!isPendingNow(pending)) pressPointerDown(o, e);
};
export const buttonPointerUp = (e: PointerEvent, o: PressOptions, pending?: Pending): void => {
  if (!isPendingNow(pending)) pressPointerUp(o, e);
};
export const buttonMouseDown = (e: MouseEvent, o: PressOptions): void => pressMouseDown(o, e);
export const buttonDragStart = (e: DragEvent, o: PressOptions): void => pressDragStart(o, e);
