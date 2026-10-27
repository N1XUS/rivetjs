// Rivet-authored (no upstream; React Aria / Angular CDK have no wheel picker): headless iOS-style scroll wheels — `Wheel`
// (one drum: an ARIA spinbutton over a column of options that spins under a fixed selection band) and `WheelPicker` (a
// labelled group of drums). Behaviour + motion: `./behaviour.ts` (house motion `@rivetjs/cdk/motion`, embla-carousel
// 8.6.0 physics, MIT, © David Jerleke). `@rivetjs/cdk/time-wheels` binds drums to a TimeField's state.
// - DOM: drum `div[role=spinbutton]` (`rv-Wheel`; `data-disabled`, `data-readonly`, `data-moving` while it spins,
//   `data-dragging` while held; inline clipping / `touch-action: none` / `--rv-wheel-visible`) > items
//   `div[data-rv-wheel-item][data-index]` (`rv-WheelItem`; `aria-hidden`; `data-selected` = at the centre,
//   `data-disabled`; inline position + `--rv-wheel-offset` / `--rv-wheel-distance`). The stylesheet sizes the drum
//   (`height: calc(var(--rv-wheel-visible) * <item height>)`) and draws the band / fade masks (`@rivetjs/ui` TimePicker).
// - Resumable: state = plain signals (`createWheelState`), handlers are inline arrows calling `./behaviour.ts`; nothing
//   runs before the first pointer / wheel / key event. On client renders a client effect spins the drum when the
//   selected value changes from outside (`wheelFollow`); a resumed page shows the new value directly.
import { untrack } from "@rivetjs/reactivity";
import { For, clientEffect, ref as createRef } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { dataBool } from "../utils/data-attrs.tsx";
import {
  createWheelState,
  isWheelOptionDisabled,
  wheelCenterIndex,
  wheelDispose,
  wheelFollow,
  wheelItemStyle,
  wheelKeyDown,
  WHEEL_KEYS,
  wheelPointerDown,
  wheelSelectedIndex,
  wheelStyle,
  wheelArm,
  type WheelOption,
  type WheelState,
  type WheelStateOptions,
  type WheelValue,
} from "./behaviour.ts";

export {
  createWheelState,
  wheelOffset,
  wheelLoops,
  wheelSelectIndex,
  wheelSelectedIndex,
  wheelArm,
  wheelCenterIndex,
  wheelPosition,
  wheelNearestEnabled,
  isWheelOptionDisabled,
  WHEEL_DRAG_THRESHOLD,
  WHEEL_RUBBER_BAND,
  WHEEL_SNAP_DELAY,
  type WheelOption,
  type WheelState,
  type WheelStateOptions,
  type WheelValue,
} from "./behaviour.ts";

export interface WheelProps<V extends WheelValue = WheelValue> extends Partial<WheelStateOptions<V>> {
  /** A state from `createWheelState` (else one is created from the props; `options` is then required). */
  state?: WheelState<V>;
  id?: string;
  /** The CSS class of the drum. @default "rv-Wheel" */
  class?: string;
  /** The CSS class of each item. @default "rv-WheelItem" */
  itemClass?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  /** Item content (default: the option's label). */
  children?: (option: WheelOption<V>, index: number) => Content;
  "data-type"?: string;
}

const valueNow = (index: number, values: readonly number[]): number | undefined => (index < 0 ? undefined : values[index]);
const valueText = (index: number, options: readonly WheelOption<WheelValue>[]): string | undefined => (index < 0 ? undefined : options[index]!.label);

/** One drum (ARIA spinbutton). */
export function Wheel<V extends WheelValue = WheelValue>(props: WheelProps<V>) {
  const state = props.state ?? createWheelState<V>(props as WheelStateOptions<V>);
  const { id, itemClass, children: renderItem } = props;
  const className = props.class ?? "rv-Wheel";
  const itemClassName = itemClass ?? "rv-WheelItem";
  const label = props["aria-label"],
    labelledBy = props["aria-labelledby"],
    describedBy = props["aria-describedby"],
    type = props["data-type"];
  const options = state.options;
  const numeric = options.every((o) => typeof o.value === "number");
  const values = options.map((o, i) => (numeric ? (o.value as number) : i));
  const min = values.length ? Math.min(...values) : undefined,
    max = values.length ? Math.max(...values) : undefined;
  const indices = options.map((_, i) => i);
  const el = createRef<HTMLDivElement>();

  // Client renders: spin when the value changes from outside (a typed segment); stop the motion on unmount.
  const follow = { previous: -1 };
  clientEffect(() => {
    const index = wheelSelectedIndex(state);
    const node = el();
    untrack(() => {
      if (node) wheelArm(state, node);
      if (node && follow.previous >= 0) wheelFollow(state, node, index, follow.previous);
    });
    follow.previous = index;
  });
  clientEffect(() => () => wheelDispose(state));

  return (
    <div
      ref={el}
      id={id}
      class={className}
      role="spinbutton"
      tabIndex={state.isDisabled ? undefined : 0}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={valueNow(wheelSelectedIndex(state), values)}
      aria-valuetext={valueText(wheelSelectedIndex(state), options)}
      aria-disabled={state.isDisabled ? "true" : undefined}
      aria-readonly={state.isReadOnly ? "true" : undefined}
      data-type={type}
      data-disabled={dataBool(state.isDisabled)}
      data-readonly={dataBool(state.isReadOnly)}
      data-rk={state.isDisabled || state.isReadOnly ? undefined : WHEEL_KEYS}
      style={wheelStyle(state.visibleItems)}
      onPointerDown={(event: PointerEvent) => wheelPointerDown(event, state)}
      onPointerOver={(event: PointerEvent) => wheelArm(state, event.currentTarget as Element)}
      onKeyDown={(event: KeyboardEvent) => wheelKeyDown(event, state)}
    >
      <For each={indices} by={(i: number) => i}>
        {(i: () => number) => {
          const index = untrack(i);
          const option = options[index]!;
          return (
            <div
              class={itemClassName}
              data-rv-wheel-item=""
              data-index={index}
              aria-hidden="true"
              data-selected={dataBool(wheelCenterIndex(state) === index)}
              data-disabled={dataBool(isWheelOptionDisabled(state, index))}
              style={wheelItemStyle(state, index)}
            >
              {renderItem ? renderItem(option, index) : option.label}
            </div>
          );
        }}
      </For>
    </div>
  );
}

export interface WheelPickerProps {
  id?: string;
  /** The CSS class of the group. @default "rv-WheelPicker" */
  class?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  dir?: "ltr" | "rtl";
  /** The drums. */
  children?: Content;
}

/** A labelled group of drums (`role="group"`, inline `display: flex`). */
export function WheelPicker(props: WheelPickerProps) {
  const { id, dir, children } = props;
  const className = props.class ?? "rv-WheelPicker";
  return (
    <div
      id={id}
      class={className}
      role="group"
      dir={dir}
      aria-label={props["aria-label"]}
      aria-labelledby={props["aria-labelledby"]}
      aria-describedby={props["aria-describedby"]}
      style={{ display: "flex" }}
    >
      {children}
    </div>
  );
}
