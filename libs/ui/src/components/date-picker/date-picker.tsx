// Ported from HeroUI v3.2.6 packages/react/src/components/date-picker/date-picker.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components` → `@rivetjs/cdk` (`date-picker` `DatePicker`, `button`,
//   `popover`); `@heroui/styles` → vendored `styles/`.
// - `DatePickerContext` carries plain data `{ inPicker: true }` instead of the tv `slots` object + `triggerRef` (`datePickerVariants` has
//   no variants: one module-level slots object): resumable token `rv-ui-date-picker`, default `{}` → parts outside a `DatePicker` get only
//   the caller's `class` (= upstream `slots?.x`).
// - Focus restore (upstream: a window keydown listener while open + `triggerRef.current.focus()` in a frame after a keyboard close): the
//   listener (module-level `onGlobalKeyDown` + `restore` flag) is added / removed in the wrapped `onOpenChange` (inline: browser
//   globals only in handlers); the trigger is found by its cdk id (`<picker id>-button`), so the root
//   passes an `id` (the caller's, else `createId()` in a keyed signal: a resumed page reuses the server's id, FACTS-GAP).
//   Module-level flag (one open picker at a time).
// - `data-required`: set by the cdk picker root itself (RAC sets it too). Children: passed through (the cdk root calls a render function).
// - Date props (`value`, `defaultValue`, `minValue`, `maxValue`, `placeholderValue`) reach the cdk picker as strings
//   (`../../utils/date-value.ts`); a controlled `value` is a Signal of the string form (cdk).
// - `TriggerIndicator` default icon: upstream inline `IconCalendar` svg → lucide `Calendar` (1em).
// - `SurfaceContext` `{ variant: "default" }` is provided around the cdk `Popover` (its lazy children render inside it).
// - Live `class` → a render-prop class function for the cdk part; static `class` stays a string.
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import type { DateValue } from "@rivetjs/cdk/date";
import { DatePicker as DatePickerPrimitive } from "@rivetjs/cdk/date-picker";
import type { DatePickerProps as DatePickerPrimitiveProps, DatePickerRenderProps } from "@rivetjs/cdk/date-picker";
import { resumedId } from "@rivetjs/cdk/id";
import { Popover as PopoverPrimitive } from "@rivetjs/cdk/popover";
import type { PopoverProps as PopoverPrimitiveProps, PopoverRenderProps } from "@rivetjs/cdk/popover";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { Calendar } from "lucide";

import type { DatePickerVariants } from "../../../styles/src/components/date-picker/index.ts";
import { datePickerVariants } from "../../../styles/src/components/date-picker/index.ts";
import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { dateProps } from "../../utils/date-value.ts";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { SurfaceContext } from "../surface/index.ts";
import { portalTheme } from "../../utils/portal-theme.ts";

const DATE_KEYS = ["value", "defaultValue", "minValue", "maxValue", "placeholderValue"] as const;

/* -------------------------------------------------------------------------------------------------
 * DatePicker Context
 * -----------------------------------------------------------------------------------------------*/
type DatePickerContext = {
  /** Rivet: set by `DatePicker` (upstream: `slots` + `triggerRef`). */
  inPicker?: boolean;
};

const DatePickerContext = createContext<DatePickerContext>({});

type DatePickerSlots = ReturnType<typeof datePickerVariants>;
let SLOTS: DatePickerSlots | undefined;
/** Upstream `use(DatePickerContext).slots`: `datePickerVariants()` inside a `DatePicker`, `undefined` outside. */
const slotsOf = (context: DatePickerContext): DatePickerSlots | undefined => (context.inPicker ? (SLOTS ??= datePickerVariants()) : undefined);
const rootSlots = (): DatePickerSlots => (SLOTS ??= datePickerVariants());

const ROOT_CONTEXT: DatePickerContext = { inPicker: true };
const DEFAULT_SURFACE_CONTEXT = { variant: "default" as SurfaceVariants["variant"] };

/* -------------------------------------------------------------------------------------------------
 * Focus restore (upstream: `shouldRestoreFocusToTriggerRef` + a window keydown listener while open)
 * -----------------------------------------------------------------------------------------------*/
/** Set by keyboard input while a picker is open; read (and reset) when it closes. */
export const restore = { pending: false };
export function onGlobalKeyDown(event: KeyboardEvent): void {
  if (!event.metaKey && !event.ctrlKey && !event.altKey) restore.pending = true;
}

/* -------------------------------------------------------------------------------------------------
 * DatePicker Root
 * -----------------------------------------------------------------------------------------------*/
interface DatePickerRootProps<T extends DateValue = DateValue> extends DatePickerPrimitiveProps<T>, DatePickerVariants {
  id?: string;
}

function DatePickerRoot<T extends DateValue = DateValue>(props: DatePickerRootProps<T>): JSX.Element {
  const [local, rest] = splitLive(props as DatePickerRootProps, ["children", "class", "id", "onOpenChange", ...DATE_KEYS]);
  const id = (local.id as string | undefined) ?? resumedId();
  const triggerId = id + "-button";
  const onOpenChange = local.onOpenChange;
  const base = rootSlots().base();
  const classOf = () => composeTwRenderProps(local.class as never, base);
  const cls = hasLiveProp(local, ["class"]) ? (values: DatePickerRenderProps) => renderClass(classOf(), values) : classOf();
  const content = () => (
    <DatePickerPrimitive
      data-slot="date-picker"
      {...(rest as object)}
      {...dateProps(local, DATE_KEYS)}
      id={id}
      class={cls as never}
      onOpenChange={(isOpen: boolean) => {
        // Upstream: track keyboard input while open; after a keyboard close, focus the trigger in a frame.
        if (isOpen) window.addEventListener("keydown", onGlobalKeyDown, true);
        else {
          window.removeEventListener("keydown", onGlobalKeyDown, true);
          if (restore.pending) window.requestAnimationFrame(() => document.getElementById(triggerId)?.focus());
        }
        restore.pending = false;
        onOpenChange?.(isOpen);
      }}
    >
      {local.children as Content}
    </DatePickerPrimitive>
  );

  return (
    <Provider token={DatePickerContext} value={ROOT_CONTEXT}>
      {content()}
    </Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * DatePicker Trigger
 * -----------------------------------------------------------------------------------------------*/
interface DatePickerTriggerProps extends ButtonPrimitiveProps {}

const DatePickerTrigger = (props: DatePickerTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(DatePickerContext);
  const trigger = slotsOf(context)?.trigger();
  const classOf = () => composeTwRenderProps(local.class as never, trigger);
  const cls = hasLiveProp(local, ["class"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <ButtonPrimitive data-slot="date-picker-trigger" {...(rest as object)} class={cls as never}>
      {local.children as Content}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * DatePicker Trigger Indicator
 * -----------------------------------------------------------------------------------------------*/
interface DatePickerTriggerIndicatorProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `DatePickerTriggerIndicator` props for the default element (`span`). */
type DatePickerTriggerIndicatorSpanProps = DatePickerTriggerIndicatorProps & Omit<JSX.IntrinsicElements["span"], keyof DatePickerTriggerIndicatorProps>;

const DatePickerTriggerIndicator = <E extends keyof JSX.IntrinsicElements = "span">(
  props: DatePickerTriggerIndicatorProps<E> & JSX.IntrinsicElements[E],
): JSX.Element => {
  const [local, rest] = splitLive(props as DatePickerTriggerIndicatorSpanProps, ["children", "class"]);
  const context = useContext(DatePickerContext);

  return (
    <dom.span
      aria-hidden="true"
      class={composeSlotClassName(slotsOf(context)?.triggerIndicator, local.class)}
      data-slot="date-picker-trigger-indicator"
      {...(rest as object)}
    >
      {local.children || <Icon icon={Calendar} size="1em" />}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * DatePicker Popover
 * -----------------------------------------------------------------------------------------------*/
interface DatePickerPopoverProps extends Omit<PopoverPrimitiveProps, "children"> {
  children: Content;
}

const DatePickerPopover = (props: DatePickerPopoverProps): JSX.Element => {
  portalTheme();
  const [local, rest] = splitLive(props, ["children", "class", "placement"]);
  const context = useContext(DatePickerContext);
  const popover = slotsOf(context)?.popover();
  const classOf = () => composeTwRenderProps(local.class as never, popover) as string | ((v: PopoverRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: PopoverRenderProps) => renderClass(classOf(), values) : classOf();
  const content = () => (
    <PopoverPrimitive {...(rest as object)} class={cls as never} data-slot="date-picker-popover" placement={local.placement ?? "bottom"}>
      {local.children}
    </PopoverPrimitive>
  );

  return (
    <Provider token={SurfaceContext} value={DEFAULT_SURFACE_CONTEXT}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export { DatePickerContext, DatePickerRoot, DatePickerTrigger, DatePickerTriggerIndicator, DatePickerPopover };

export type { DatePickerRootProps, DatePickerTriggerProps, DatePickerTriggerIndicatorProps, DatePickerPopoverProps };
