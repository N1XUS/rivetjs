// Ported from HeroUI v3.2.6 packages/react/src/components/date-range-picker/date-range-picker.tsx (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet:
// - `"use client"` dropped; `className` → `class`; `react-aria-components` → `@rivetjs/cdk` (`date-range-picker` `DateRangePicker`, `button`,
//   `popover`); `@heroui/styles` → vendored `styles/`.
// - `DateRangePickerContext` carries plain data `{ inRangePicker: true }` instead of the tv `slots` object + `triggerRef` (`dateRangePickerVariants` has
//   no variants: one module-level slots object): resumable token `rv-ui-date-range-picker`, default `{}` → parts outside a `DateRangePicker` get only
//   the caller's `class` (= upstream `slots?.x`).
// - Focus restore (upstream: a window keydown listener while open + `triggerRef.current.focus()` in a frame after a keyboard close): the
//   listener (module-level `onGlobalKeyDown` + `restore` flag) is added / removed in the wrapped `onOpenChange` (inline: browser
//   globals only in handlers); the trigger is found by its cdk id (`<picker id>-button`), so the root
//   passes an `id` (the caller's, else `createId()` in a keyed signal: a resumed page reuses the server's id, FACTS-GAP).
//   Module-level flag (one open picker at a time).
// - `data-required`: set by the cdk picker root itself (RAC sets it too). Children: passed through (the cdk root calls a render function).
// - Date props (`value`, `defaultValue`, `minValue`, `maxValue`, `placeholderValue`) reach the cdk picker as strings
//   (`../../utils/date-value.ts`: ranges map `{ start, end }`); a controlled `value` is a Signal of `{ start, end }` strings (cdk).
// - Focus restore shares the date picker's module-level flag (`../date-picker/date-picker.tsx` `restore` / `onGlobalKeyDown`).
// - `TriggerIndicator` default icon: upstream inline `IconCalendar` svg → lucide `Calendar` (1em).
// - `SurfaceContext` `{ variant: "default" }` is provided around the cdk `Popover` (its lazy children render inside it).
// - Live `class` → a render-prop class function for the cdk part; static `class` stays a string.
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import type { DateValue } from "@rivetjs/cdk/date";
import { DateRangePicker as DateRangePickerPrimitive } from "@rivetjs/cdk/date-picker";
import type { DateRangePickerProps as DateRangePickerPrimitiveProps, DateRangePickerRenderProps } from "@rivetjs/cdk/date-picker";
import { resumedId } from "@rivetjs/cdk/id";
import { Popover as PopoverPrimitive } from "@rivetjs/cdk/popover";
import type { PopoverProps as PopoverPrimitiveProps, PopoverRenderProps } from "@rivetjs/cdk/popover";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { Calendar } from "lucide";

import type { DateRangePickerVariants } from "../../../styles/src/components/date-range-picker/index.ts";
import { dateRangePickerVariants } from "../../../styles/src/components/date-range-picker/index.ts";
import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import { dateProps } from "../../utils/date-value.ts";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { onGlobalKeyDown, restore } from "../date-picker/date-picker.tsx";
import { SurfaceContext } from "../surface/index.ts";
import { portalTheme } from "../../utils/portal-theme.ts";

const DATE_KEYS = ["value", "defaultValue", "minValue", "maxValue", "placeholderValue"] as const;

/* -------------------------------------------------------------------------------------------------
 * DateRangePicker Context
 * -----------------------------------------------------------------------------------------------*/
type DateRangePickerContext = {
  /** Rivet: set by `DateRangePicker` (upstream: `slots` + `triggerRef`). */
  inRangePicker?: boolean;
};

const DateRangePickerContext = createContext<DateRangePickerContext>({});

type DateRangePickerSlots = ReturnType<typeof dateRangePickerVariants>;
let SLOTS: DateRangePickerSlots | undefined;
/** Upstream `use(DateRangePickerContext).slots`: `dateRangePickerVariants()` inside a `DateRangePicker`, `undefined` outside. */
const slotsOf = (context: DateRangePickerContext): DateRangePickerSlots | undefined =>
  context.inRangePicker ? (SLOTS ??= dateRangePickerVariants()) : undefined;
const rootSlots = (): DateRangePickerSlots => (SLOTS ??= dateRangePickerVariants());

const ROOT_CONTEXT: DateRangePickerContext = { inRangePicker: true };
const DEFAULT_SURFACE_CONTEXT = { variant: "default" as SurfaceVariants["variant"] };

/* -------------------------------------------------------------------------------------------------
 * DateRangePicker Root
 * -----------------------------------------------------------------------------------------------*/
interface DateRangePickerRootProps<T extends DateValue = DateValue> extends DateRangePickerPrimitiveProps<T>, DateRangePickerVariants {
  id?: string;
}

function DateRangePickerRoot<T extends DateValue = DateValue>(props: DateRangePickerRootProps<T>): JSX.Element {
  const [local, rest] = splitLive(props as DateRangePickerRootProps, ["children", "class", "id", "onOpenChange", ...DATE_KEYS]);
  const id = (local.id as string | undefined) ?? resumedId();
  const triggerId = id + "-button";
  const onOpenChange = local.onOpenChange;
  const base = rootSlots().base();
  const classOf = () => composeTwRenderProps(local.class as never, base);
  const cls = hasLiveProp(local, ["class"]) ? (values: DateRangePickerRenderProps) => renderClass(classOf(), values) : classOf();
  const content = () => (
    <DateRangePickerPrimitive
      data-slot="date-range-picker"
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
    </DateRangePickerPrimitive>
  );

  return (
    <Provider token={DateRangePickerContext} value={ROOT_CONTEXT}>
      {content()}
    </Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * DateRangePicker Trigger
 * -----------------------------------------------------------------------------------------------*/
interface DateRangePickerTriggerProps extends ButtonPrimitiveProps {}

const DateRangePickerTrigger = (props: DateRangePickerTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(DateRangePickerContext);
  const trigger = slotsOf(context)?.trigger();
  const classOf = () => composeTwRenderProps(local.class as never, trigger);
  const cls = hasLiveProp(local, ["class"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <ButtonPrimitive data-slot="date-range-picker-trigger" {...(rest as object)} class={cls as never}>
      {local.children as Content}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * DateRangePicker Trigger Indicator
 * -----------------------------------------------------------------------------------------------*/
interface DateRangePickerTriggerIndicatorProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `DateRangePickerTriggerIndicator` props for the default element (`span`). */
type DateRangePickerTriggerIndicatorSpanProps = DateRangePickerTriggerIndicatorProps &
  Omit<JSX.IntrinsicElements["span"], keyof DateRangePickerTriggerIndicatorProps>;

const DateRangePickerTriggerIndicator = <E extends keyof JSX.IntrinsicElements = "span">(
  props: DateRangePickerTriggerIndicatorProps<E> & JSX.IntrinsicElements[E],
): JSX.Element => {
  const [local, rest] = splitLive(props as DateRangePickerTriggerIndicatorSpanProps, ["children", "class"]);
  const context = useContext(DateRangePickerContext);

  return (
    <dom.span
      aria-hidden="true"
      class={composeSlotClassName(slotsOf(context)?.triggerIndicator, local.class)}
      data-slot="date-range-picker-trigger-indicator"
      {...(rest as object)}
    >
      {local.children || <Icon icon={Calendar} size="1em" />}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * DateRangePicker Range Separator
 * -----------------------------------------------------------------------------------------------*/
interface DateRangePickerRangeSeparatorProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `DateRangePickerRangeSeparator` props for the default element (`span`). */
type DateRangePickerRangeSeparatorSpanProps = DateRangePickerRangeSeparatorProps &
  Omit<JSX.IntrinsicElements["span"], keyof DateRangePickerRangeSeparatorProps>;

const DateRangePickerRangeSeparator = <E extends keyof JSX.IntrinsicElements = "span">(
  props: DateRangePickerRangeSeparatorProps<E> & JSX.IntrinsicElements[E],
): JSX.Element => {
  const [local, rest] = splitLive(props as DateRangePickerRangeSeparatorSpanProps, ["children", "class"]);
  const context = useContext(DateRangePickerContext);

  return (
    <dom.span
      aria-hidden="true"
      class={composeSlotClassName(slotsOf(context)?.rangeSeparator, local.class)}
      data-slot="date-range-picker-range-separator"
      {...(rest as object)}
    >
      {local.children === undefined ? " - " : local.children}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * DateRangePicker Popover
 * -----------------------------------------------------------------------------------------------*/
interface DateRangePickerPopoverProps extends Omit<PopoverPrimitiveProps, "children"> {
  children: Content;
}

const DateRangePickerPopover = (props: DateRangePickerPopoverProps): JSX.Element => {
  portalTheme();
  const [local, rest] = splitLive(props, ["children", "class", "placement"]);
  const context = useContext(DateRangePickerContext);
  const popover = slotsOf(context)?.popover();
  const classOf = () => composeTwRenderProps(local.class as never, popover) as string | ((v: PopoverRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: PopoverRenderProps) => renderClass(classOf(), values) : classOf();
  const content = () => (
    <PopoverPrimitive {...(rest as object)} class={cls as never} data-slot="date-range-picker-popover" placement={local.placement ?? "bottom"}>
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
export {
  DateRangePickerContext,
  DateRangePickerRoot,
  DateRangePickerTrigger,
  DateRangePickerTriggerIndicator,
  DateRangePickerRangeSeparator,
  DateRangePickerPopover,
};

export type {
  DateRangePickerRootProps,
  DateRangePickerTriggerProps,
  DateRangePickerTriggerIndicatorProps,
  DateRangePickerRangeSeparatorProps,
  DateRangePickerPopoverProps,
};
