// Rivet-authored (no HeroUI counterpart: HeroUI v3.2.6 TimeField has no popover). User request 2026-10-09: "time picker - maybe
// add optional popover with carousel drums for time? looped". A ui TimeField whose trigger opens a popover of iOS-style wheel
// drums (`@rivetjs/cdk/time-wheels`: looped hour / minute / second drums + AM / PM, house motion); the drums and the segments
// edit the same value. Parts mirror DatePicker (Root / Trigger / TriggerIndicator / Popover) + `Wheels`.
// - Root = ui `TimeFieldRoot` (+ `time-picker` class) whose children sit in a cdk `DialogTrigger` (`isOpen` / `defaultOpen` /
//   `onOpenChange`): the Trigger (cdk Button) toggles it, the Popover (cdk, on the div overlay layer, role=dialog) is
//   positioned at the trigger, focus returns to the trigger on close (cdk Overlay focus scope).
// - Popover children: a render function (`{() => <TimePicker.Wheels />}`) so nothing renders (or loads) before it opens;
//   no children = the default Wheels.
// - Trigger disabled with the field (`isDisabled` / `isReadOnly` of the TimeField state).
// - `TimePickerContext` = plain data `{ inPicker: true }` (resumable token `rv-ui-time-picker`, default `{}`): Trigger /
//   TriggerIndicator / Popover outside a TimePicker get only the caller's `class` (DatePicker convention). Wheels always
//   carry their slot classes (no HeroUI look otherwise).
// - TriggerIndicator default icon: lucide `Clock` (1em).
import { Button as ButtonPrimitive } from "@rivetjs/cdk/button";
import type { ButtonProps as ButtonPrimitiveProps, ButtonRenderProps } from "@rivetjs/cdk/button";
import { TimeFieldStateContext } from "@rivetjs/cdk/date-field";
import type { DateFieldRenderProps } from "@rivetjs/cdk/date-field";
import { DialogTrigger } from "@rivetjs/cdk/dialog";
import { Popover as PopoverPrimitive } from "@rivetjs/cdk/popover";
import type { PopoverProps as PopoverPrimitiveProps, PopoverRenderProps } from "@rivetjs/cdk/popover";
import { ownerOf } from "@rivetjs/cdk/state/date-field";
import type { TimeValue } from "@rivetjs/cdk/state/time-field";
import { TimeWheels } from "@rivetjs/cdk/time-wheels";
import type { TimeWheelsProps } from "@rivetjs/cdk/time-wheels";
import { Icon } from "@rivetjs/kit/icon";
import { createContext, useContext } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { resumableContext } from "@rivetjs/runtime/resume-format";
import { Clock } from "lucide";

import type { SurfaceVariants } from "../../../styles/src/components/surface/index.ts";
import type { TimePickerVariants } from "../../../styles/src/components/time-picker/index.ts";
import { timePickerVariants } from "../../../styles/src/components/time-picker/index.ts";
import { composeSlotClassName, composeTwRenderProps } from "../../utils/compose.tsx";
import type { DOMRenderProps } from "../../utils/dom.tsx";
import { dom } from "../../utils/dom.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";
import { SurfaceContext } from "../surface/index.ts";
import { TimeFieldRoot } from "../time-field/time-field.tsx";
import type { TimeFieldRootProps } from "../time-field/time-field.tsx";
import { portalTheme } from "../../utils/portal-theme.ts";

/* -------------------------------------------------------------------------------------------------
 * TimePicker Context
 * -----------------------------------------------------------------------------------------------*/
type TimePickerContext = {
  /** Set by `TimePicker`. */
  inPicker?: boolean;
};

const TimePickerContext = resumableContext(createContext<TimePickerContext>({}, { id: "rv-ui-time-picker" }));

type TimePickerSlots = ReturnType<typeof timePickerVariants>;
let SLOTS: TimePickerSlots | undefined;
const allSlots = (): TimePickerSlots => (SLOTS ??= timePickerVariants());
/** Slots inside a `TimePicker`, `undefined` outside. */
const slotsOf = (context: TimePickerContext): TimePickerSlots | undefined => (context.inPicker ? allSlots() : undefined);

const ROOT_CONTEXT: TimePickerContext = { inPicker: true };
const DEFAULT_SURFACE_CONTEXT = { variant: "default" as SurfaceVariants["variant"] };

/* -------------------------------------------------------------------------------------------------
 * TimePicker Root
 * -----------------------------------------------------------------------------------------------*/
interface TimePickerRootProps<T extends TimeValue = TimeValue> extends TimeFieldRootProps<T>, TimePickerVariants {
  /** Whether the popover is open (controlled): a plain value, a two-way Signal, or a read-only accessor. */
  isOpen?: boolean | Signal<boolean> | (() => boolean);
  /** Whether the popover is open by default (uncontrolled). */
  defaultOpen?: boolean;
  /** Called when the popover opens or closes. */
  onOpenChange?: (isOpen: boolean) => void;
}

function TimePickerRoot<T extends TimeValue = TimeValue>(props: TimePickerRootProps<T>): JSX.Element {
  const [local, rest] = splitLive(props as TimePickerRootProps, ["children", "class", "isOpen", "defaultOpen", "onOpenChange"]);
  const base = allSlots().base();
  const classOf = () => composeTwRenderProps(local.class as never, base);
  const cls = hasLiveProp(local, ["class"]) ? (values: DateFieldRenderProps) => renderClass(classOf(), values) : classOf();
  const content = () => (
    <TimeFieldRoot data-slot="time-picker" {...(rest as object)} class={cls as never}>
      <DialogTrigger isOpen={local.isOpen} defaultOpen={local.defaultOpen} onOpenChange={local.onOpenChange}>
        {local.children as Content}
      </DialogTrigger>
    </TimeFieldRoot>
  );

  return (
    <Provider token={TimePickerContext} value={ROOT_CONTEXT}>
      {content()}
    </Provider>
  );
}

/* -------------------------------------------------------------------------------------------------
 * TimePicker Trigger
 * -----------------------------------------------------------------------------------------------*/
interface TimePickerTriggerProps extends ButtonPrimitiveProps {}

const TimePickerTrigger = (props: TimePickerTriggerProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "isDisabled"]);
  const context = useContext(TimePickerContext);
  const state = useContext(TimeFieldStateContext);
  const owner = state ? ownerOf(state) : undefined;
  const fieldDisabled = !!owner && (owner.isDisabled || owner.isReadOnly);
  const trigger = slotsOf(context)?.trigger();
  const classOf = () => composeTwRenderProps(local.class as never, trigger);
  const cls = hasLiveProp(local, ["class"]) ? (values: ButtonRenderProps) => renderClass(classOf(), values) : classOf();

  return (
    <ButtonPrimitive
      data-slot="time-picker-trigger"
      {...(rest as object)}
      isDisabled={fieldDisabled || (local.isDisabled as boolean | undefined)}
      class={cls as never}
    >
      {local.children as Content}
    </ButtonPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * TimePicker Trigger Indicator
 * -----------------------------------------------------------------------------------------------*/
interface TimePickerTriggerIndicatorProps<E extends keyof JSX.IntrinsicElements = "span"> extends DOMRenderProps<E, undefined> {
  children?: Content;
  class?: string;
}

/** `TimePickerTriggerIndicator` props for the default element (`span`). */
type TimePickerTriggerIndicatorSpanProps = TimePickerTriggerIndicatorProps & Omit<JSX.IntrinsicElements["span"], keyof TimePickerTriggerIndicatorProps>;

const TimePickerTriggerIndicator = <E extends keyof JSX.IntrinsicElements = "span">(
  props: TimePickerTriggerIndicatorProps<E> & JSX.IntrinsicElements[E],
): JSX.Element => {
  const [local, rest] = splitLive(props as TimePickerTriggerIndicatorSpanProps, ["children", "class"]);
  const context = useContext(TimePickerContext);

  return (
    <dom.span
      aria-hidden="true"
      class={composeSlotClassName(slotsOf(context)?.triggerIndicator, local.class)}
      data-slot="time-picker-trigger-indicator"
      {...(rest as object)}
    >
      {local.children || <Icon icon={Clock} size="1em" />}
    </dom.span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * TimePicker Wheels
 * -----------------------------------------------------------------------------------------------*/
interface TimePickerWheelsProps extends TimeWheelsProps {}

/** The drums (cdk `TimeWheels` with the HeroUI look); focuses the first drum when it mounts (`autoFocus`, default true). */
const TimePickerWheels = (props: TimePickerWheelsProps): JSX.Element => {
  const slots = allSlots();
  const { class: cls, wheelClass, itemClass, autoFocus, ...rest } = props;
  return (
    <TimeWheels
      {...rest}
      autoFocus={autoFocus ?? true}
      class={composeSlotClassName(slots.wheels, cls)}
      wheelClass={composeSlotClassName(slots.wheel, wheelClass)}
      itemClass={composeSlotClassName(slots.item, itemClass)}
    />
  );
};

/* -------------------------------------------------------------------------------------------------
 * TimePicker Popover
 * -----------------------------------------------------------------------------------------------*/
interface TimePickerPopoverProps extends Omit<PopoverPrimitiveProps, "children"> {
  /** Popover content; a render function renders on open. @default the Wheels */
  children?: Content;
}

const TimePickerPopover = (props: TimePickerPopoverProps): JSX.Element => {
  portalTheme();
  const [local, rest] = splitLive(props, ["children", "class", "placement"]);
  const context = useContext(TimePickerContext);
  const popover = slotsOf(context)?.popover();
  const classOf = () => composeTwRenderProps(local.class as never, popover) as string | ((v: PopoverRenderProps) => string);
  const cls = hasLiveProp(local, ["class"]) ? (values: PopoverRenderProps) => renderClass(classOf(), values) : classOf();
  const children = local.children ?? (() => <TimePickerWheels />);
  const content = () => (
    <PopoverPrimitive {...(rest as object)} class={cls as never} data-slot="time-picker-popover" placement={local.placement ?? "bottom end"}>
      {children}
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
export { TimePickerContext, TimePickerRoot, TimePickerTrigger, TimePickerTriggerIndicator, TimePickerPopover, TimePickerWheels };

export type { TimePickerRootProps, TimePickerTriggerProps, TimePickerTriggerIndicatorProps, TimePickerPopoverProps, TimePickerWheelsProps };
