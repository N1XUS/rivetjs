// Rivet-authored (no upstream; React Aria has no wheel time picker): `TimeWheels` — iOS-style drums (hours, minutes,
// optional seconds, AM / PM per the locale's hour cycle) for a TimeField. Drums = `@rivetjs/cdk/wheel-picker` `Wheel`s
// (spinbuttons, house motion); values = the TimeField state's (`./behaviour.ts`), so the segments and the drums edit
// the same value. Numeric drums loop (59 → 00), AM / PM does not.
// - State: `state` prop, else the enclosing `TimeField`'s (`TimeFieldStateContext`, resumable) — put it inside the field,
//   e.g. in a Popover opened from the field (`<DialogTrigger>` around the group + `<Popover>`), as a render-function
//   child so nothing renders before it opens.
// - Layout: group `div[role=group]` (`rv-TimeWheels`, `dir` of the locale, inline `display: flex`); the numeric drums sit in
//   an inline `display: flex; direction: ltr` run (`rv-TimeWheels-run`), as the field wraps its time segments in LTR
//   isolates, so RTL locales keep hour → minute → second left to right with AM / PM on the locale's side.
import { untrack, useContext } from "@rivetjs/reactivity";
import { For, clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import { focusSafely } from "../focus/index.ts";
import { isRTL } from "../i18n/index.ts";
import { displayNames } from "../date-field/behaviour.tsx";
import { DateFieldStateContext, TimeFieldStateContext } from "../date-field/index.tsx";
import { fieldDateFormatter, ownerOf, segments, type DateFieldState } from "../state/date-field.ts";
import { Wheel } from "../wheel-picker/index.tsx";
import { createWheelState } from "../wheel-picker/behaviour.ts";
import {
  TIME_WHEEL_TYPES,
  isTimeWheelOptionDisabled,
  setTimeWheelValue,
  timeWheelOptions,
  timeWheelValue,
  type TimeWheelType,
  type TimeWheelsConfig,
} from "./behaviour.ts";

export {
  TIME_WHEEL_TYPES,
  dayPeriodLabels,
  isTimeWheelOptionDisabled,
  setTimeWheelValue,
  timeWheelOptions,
  timeWheelValue,
  type TimeWheelType,
  type TimeWheelsConfig,
} from "./behaviour.ts";

export interface TimeWheelsProps {
  /** The field state (default: the enclosing TimeField's, then DateField's). */
  state?: DateFieldState;
  /** Minutes between minute drum options. @default 1 */
  minuteStep?: number;
  /** Seconds between second drum options. @default 1 */
  secondStep?: number;
  /** Whether the numeric drums wrap around. @default true */
  loop?: boolean;
  /** Items visible per drum (odd). @default 5 */
  visibleItems?: number;
  /** Focus the first enabled drum when mounted (client renders, e.g. a popover opening). @default false */
  autoFocus?: boolean;
  /** The CSS class of the group. @default "rv-TimeWheels" */
  class?: string;
  /** The CSS class of each drum. @default "rv-Wheel" */
  wheelClass?: string;
  /** The CSS class of each drum item. @default "rv-WheelItem" */
  itemClass?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

interface WheelEntry {
  type: TimeWheelType;
  label: string;
}
interface RunEntry {
  run: boolean;
  wheels: WheelEntry[];
}

interface TimeDrumProps {
  state: DateFieldState;
  type: TimeWheelType;
  label: string;
  config: TimeWheelsConfig;
  twoDigitHour: boolean;
  loop: boolean;
  visibleItems: number;
  wheelClass: string | undefined;
  itemClass: string | undefined;
}

/** One time drum (its own component: the wheel state's closures are resumable component locals). */
function TimeDrum(props: TimeDrumProps) {
  const { state, type, label, config, twoDigitHour, visibleItems, wheelClass, itemClass } = props;
  const owner = ownerOf(state);
  const { minuteStep, secondStep } = config;
  const wheel = createWheelState<number>({
    options: timeWheelOptions(type, { locale: state.locale, hourCycle: state.hourCycle, twoDigitHour, minuteStep, secondStep }),
    value: () => timeWheelValue(state, type, config),
    onChange: (value: number) => setTimeWheelValue(state, type, value, config),
    isOptionDisabled: (value: number) => isTimeWheelOptionDisabled(state, type, value, config),
    loop: props.loop && type !== "dayPeriod",
    isDisabled: owner.isDisabled,
    isReadOnly: owner.isReadOnly,
    visibleItems,
    pageStep: type === "hour" ? 2 : type === "dayPeriod" ? 1 : Math.max(1, Math.round(15 / (type === "minute" ? minuteStep : secondStep))),
  });
  return <Wheel state={wheel} class={wheelClass} itemClass={itemClass} aria-label={label} data-type={type} />;
}

/** Drums for a TimeField (inside it, or with `state`). */
export function TimeWheels(props: TimeWheelsProps) {
  const state = props.state ?? useContext(TimeFieldStateContext) ?? useContext(DateFieldStateContext);
  if (!state) return null;
  const owner = ownerOf(state);
  const locale = state.locale;
  const hourCycle = state.hourCycle;
  const types = untrack(() => segments(state))
    .filter((s) => s.isEditable && TIME_WHEEL_TYPES.includes(s.type as TimeWheelType))
    .map((s) => s.type as TimeWheelType);
  const minuteStep = Math.max(1, Math.floor(props.minuteStep ?? 1)),
    secondStep = Math.max(1, Math.floor(props.secondStep ?? 1));
  const config: TimeWheelsConfig = { types, minuteStep, secondStep };
  const twoDigitHour = !!owner.shouldForceLeadingZeros || untrack(() => fieldDateFormatter(state).resolvedOptions().hour === "2-digit");
  const names = displayNames(locale);
  const { id, wheelClass, itemClass, visibleItems } = props;
  const loop = props.loop ?? true;
  const className = props.class ?? "rv-TimeWheels";
  const label = props["aria-label"],
    labelledBy = props["aria-labelledby"];
  const group = createRef<HTMLDivElement>();
  if (props.autoFocus)
    clientEffect(() => {
      const first = group()?.querySelector<HTMLElement>("[role=spinbutton][tabindex]");
      if (first) untrack(() => focusSafely(first));
    });
  // Numeric drums grouped into LTR runs (segment order of the locale).
  const entries: RunEntry[] = [];
  for (const type of types) {
    const wheel = { type, label: names.of(type) ?? type };
    const last = entries[entries.length - 1];
    if (type !== "dayPeriod" && last?.run) last.wheels.push(wheel);
    else entries.push({ run: type !== "dayPeriod", wheels: [wheel] });
  }

  const drum = (entry: WheelEntry) => (
    <TimeDrum
      state={state}
      type={entry.type}
      label={entry.label}
      config={config}
      twoDigitHour={twoDigitHour}
      loop={loop}
      visibleItems={visibleItems ?? 5}
      wheelClass={wheelClass}
      itemClass={itemClass}
    />
  );

  return (
    <div
      ref={group}
      id={id}
      class={className}
      role="group"
      dir={isRTL(locale) ? "rtl" : "ltr"}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-disabled={owner.isDisabled ? "true" : undefined}
      style={{ display: "flex" }}
    >
      <For each={entries} by={(entry: RunEntry) => entry}>
        {(entry: () => RunEntry) => {
          const e = untrack(entry);
          if (!e.run) return drum(e.wheels[0]!);
          return (
            <div class="rv-TimeWheels-run" style={{ display: "flex", direction: "ltr" }}>
              <For each={e.wheels} by={(w: WheelEntry) => w.type}>
                {(w: () => WheelEntry) => drum(untrack(w))}
              </For>
            </div>
          );
        }}
      </For>
    </div>
  );
}
