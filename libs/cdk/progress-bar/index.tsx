// Ported from react-aria-components `ProgressBar` (packages/react-aria-components/src/ProgressBar.tsx), Apache-2.0, © Adobe.
// Progress bars show either determinate or indeterminate progress of an operation over time.
// Rivet:
// - render props are accessors (`{({ percentage, valueText }) => <div style={{ width: percentage() + "%" }} />}`);
//   `class` / `style` may be functions of them (RAC `className` → `class`).
// - the label: `<Label>` inside gets `{ id, elementType: "span" }` from `LabelContext`; `aria-labelledby` points
//   at it while it is attached (`createSlot`: server render assumes it is, when no `aria-label` / `aria-labelledby`).
// - `value` / `minValue` / `maxValue` / `valueLabel` / `isIndeterminate` accept accessors (`value={() => progress()}`):
//   the aria attributes and render props update in their bindings (the component runs once).
// `render` (RAC DOMRenderProps): given, the attributes object (reactive entries are accessors) goes to `render(attrs, renderProps)` instead of the default element.
import { untrack } from "@rivetjs/reactivity";
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
import { read } from "../interactions/utils.ts";
import { ProgressBarContext } from "./context.ts";
import { percentageOfProps, progressBarProps, type AriaProgressBarProps } from "./behaviour.tsx";

export { progressBarProps, percentageOf, type AriaProgressBarProps, type ProgressBarAria } from "./behaviour.tsx";

const OWNED = ["style", "render"] as const;

export interface ProgressBarRenderProps {
  /** The value as a percentage between the minimum and maximum (undefined while indeterminate). */
  percentage: () => number | undefined;
  /**
   * A formatted version of the value.
   *
   * @selector [aria-valuetext]
   */
  valueText: () => string | undefined;
  /**
   * Whether the progress bar is indeterminate.
   *
   * @selector :not([aria-valuenow])
   */
  isIndeterminate: () => boolean;
}

export interface ProgressBarProps
  extends
    Omit<AriaProgressBarProps, "label">,
    RenderProps<ProgressBarRenderProps>,
    DOMRenderProps<"div", ProgressBarRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  ref?: RefValue<HTMLDivElement>;
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-ProgressBar'
   */
  class?: ClassNameOrFunction<ProgressBarRenderProps>;
}

/** RAC `ProgressBarContext`: `./context.ts` (Button imports it from there). */
export { ProgressBarContext };

/**
 * Progress bars show either determinate or indeterminate progress of an operation
 * over time.
 */
export function ProgressBar(props: ProgressBarProps) {
  // Live props (P5): the value props become accessors (the bag reads them with `read` in bindings), class / style /
  // children from a live view; the rest of the body is read once (untracked).
  return untrack(() => progressBar(props));
}

const LIVE_KEYS = ["value", "minValue", "maxValue", "valueLabel", "isIndeterminate", "formatOptions"] as const;

function progressBar(props: ProgressBarProps) {
  const [ctxMerged, ref] = contextProps(props, props.ref, ProgressBarContext);
  const merged = hasLive(ctxMerged) ? liveOptions(ctxMerged, LIVE_KEYS as never) : ctxMerged;
  const indeterminate = merged.isIndeterminate;
  const isIndeterminate = () => !!read(indeterminate);

  const initialLabel = !merged["aria-label"] && !merged["aria-labelledby"];
  const [labelRef, hasLabel] = createSlot(initialLabel);
  // `children` left out: the bag's accessors (`aria-valuetext`, a render prop) must not capture them (resumed pages).
  const { progressBarProps: barProps, labelProps } = progressBarProps({ ...merged, children: undefined, label: initialLabel } as AriaProgressBarProps);
  const labelledBy = barProps["aria-labelledby"];

  // Calculate the width of the progress bar as a percentage
  // A narrow view of the range keys (not `merged`: the render props' `percentage` would capture the children too).
  const range = liveView(merged, ["value", "minValue", "maxValue"]);
  const percentage = () => (isIndeterminate() ? undefined : percentageOfProps(range));
  const valueText = barProps["aria-valuetext"];

  const values = { percentage, valueText, isIndeterminate };
  const rp = renderPropsOf(merged, { defaultClassName: "rv-ProgressBar", values });

  const dom = globalDOMProps(merged, OWNED);
  const slot = merged.slot || undefined;
  const { id, role } = barProps;
  const ariaLabel = barProps["aria-label"];
  const describedBy = barProps["aria-describedby"];
  const details = barProps["aria-details"];
  const valueNow = barProps["aria-valuenow"];
  const valueMin = barProps["aria-valuemin"];
  const valueMax = barProps["aria-valuemax"];
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
