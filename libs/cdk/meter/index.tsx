// Ported from react-aria-components `Meter` (packages/react-aria-components/src/Meter.tsx), Apache-2.0, © Adobe.
// A meter represents a quantity within a known range, or a fractional value.
// Rivet:
// - render props are accessors (`{({ percentage, valueText }) => <div style={{ width: percentage() + "%" }} />}`);
//   `class` / `style` may be functions of them (RAC `className` → `class`).
// - the label: `<Label>` inside gets `{ id, elementType: "span" }` from `LabelContext`; `aria-labelledby` points
//   at it while it is attached (`createSlot`: server render assumes it is, when no `aria-label` / `aria-labelledby`).
// - `value` / `minValue` / `maxValue` / `valueLabel` accept accessors (`value={() => progress()}`):
//   the aria attributes and render props update in their bindings (the component runs once).
// `render` (RAC DOMRenderProps): given, the attributes object (reactive entries are accessors) goes to `render(attrs, renderProps)` instead of the default element.
import { createContext, untrack } from "@rivetjs/reactivity";
import { hasLive, liveOptions, liveView } from "../utils/live.tsx";
import { Provider } from "@rivetjs/runtime/dom";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import {
  contextProps,
  createSlot,
  renderPropsOf,
  type ContextValue,
  type RefValue,
  type ClassNameOrFunction,
  type RenderProps,
  type SlotProps,
} from "../slots/index.tsx";
import { LabelContext } from "../label/index.tsx";
import { meterProps, percentageOfProps, type AriaMeterProps } from "./behaviour.tsx";

export { meterProps, type AriaMeterProps, type MeterAria } from "./behaviour.tsx";

const OWNED = ["style", "render"] as const;

export interface MeterRenderProps {
  /** The value as a percentage between the minimum and maximum. */
  percentage: () => number;
  /**
   * A formatted version of the value.
   *
   * @selector [aria-valuetext]
   */
  valueText: () => string | undefined;
}

export interface MeterProps
  extends
    Omit<AriaMeterProps, "label">,
    RenderProps<MeterRenderProps>,
    DOMRenderProps<"div", MeterRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  ref?: RefValue<HTMLDivElement>;
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-Meter'
   */
  class?: ClassNameOrFunction<MeterRenderProps>;
}

/** RAC `MeterContext`. */
export const MeterContext = createContext<ContextValue<MeterProps, HTMLDivElement>>(null);

/**
 * A meter represents a quantity within a known range, or a fractional value.
 */
export function Meter(props: MeterProps) {
  // Live props (P5): the value props become accessors (the bag reads them with `read` in bindings), class / style /
  // children from a live view; the rest of the body is read once (untracked).
  return untrack(() => meter(props));
}

const LIVE_KEYS = ["value", "minValue", "maxValue", "valueLabel", "isIndeterminate", "formatOptions"] as const;

function meter(props: MeterProps) {
  const [ctxMerged, ref] = contextProps(props, props.ref, MeterContext);
  const merged = hasLive(ctxMerged) ? liveOptions(ctxMerged, LIVE_KEYS as never) : ctxMerged;

  const initialLabel = !merged["aria-label"] && !merged["aria-labelledby"];
  const [labelRef, hasLabel] = createSlot(initialLabel);
  // `children` left out: the bag's accessors (`aria-valuetext`, a render prop) must not capture them (resumed pages).
  const { meterProps: attrs, labelProps } = meterProps({ ...merged, children: undefined, label: initialLabel } as AriaMeterProps);
  const labelledBy = attrs["aria-labelledby"];

  // Calculate the width of the progress bar as a percentage
  // A narrow view of the range keys (not `merged`: the render props' `percentage` would capture the children too).
  const range = liveView(merged, ["value", "minValue", "maxValue"]);
  const percentage = () => percentageOfProps(range);
  const valueText = attrs["aria-valuetext"];

  const values = { percentage, valueText };
  const rp = renderPropsOf(merged, { defaultClassName: "rv-Meter", values });

  const dom = globalDOMProps(merged, OWNED);
  const slot = merged.slot || undefined;
  const { id, role } = attrs;
  const ariaLabel = attrs["aria-label"];
  const describedBy = attrs["aria-describedby"];
  const details = attrs["aria-details"];
  const valueNow = attrs["aria-valuenow"];
  const valueMin = attrs["aria-valuemin"];
  const valueMax = attrs["aria-valuemax"];
  const labelValue = { id: labelProps.id, ref: labelRef, elementType: "span" };
  if (merged.render) {
    const attrs = {
      ...dom,
      ref: ref as never,
      id,
      role,
      class: () => rp.class(),
      style: () => rp.style(),
      slot,
      "aria-label": ariaLabel,
      "aria-labelledby": () => (initialLabel ? (hasLabel() ? labelledBy : undefined) : labelledBy),
      "aria-describedby": describedBy,
      "aria-details": details,
      "aria-valuenow": valueNow,
      "aria-valuemin": valueMin,
      "aria-valuemax": valueMax,
      "aria-valuetext": valueText,
      children: () => (
        <Provider token={LabelContext} value={labelValue}>
          {rp.children()}
        </Provider>
      ),
    };
    return merged.render(attrs as never, values);
  }
  return (
    <div
      {...dom}
      ref={ref as never}
      id={id}
      role={role}
      class={rp.class()}
      style={rp.style()}
      slot={slot}
      aria-label={ariaLabel}
      aria-labelledby={initialLabel ? (hasLabel() ? labelledBy : undefined) : labelledBy}
      aria-describedby={describedBy}
      aria-details={details}
      aria-valuenow={valueNow()}
      aria-valuemin={valueMin()}
      aria-valuemax={valueMax()}
      aria-valuetext={valueText()}
    >
      <Provider token={LabelContext} value={labelValue}>
        {rp.children()}
      </Provider>
    </div>
  );
}
