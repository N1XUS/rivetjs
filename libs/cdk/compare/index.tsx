// Rivet-authored (no upstream: React Aria / React Aria Components / Angular CDK have no compare slider): headless
// before / after comparison — `Compare` (root), `CompareBefore` / `CompareAfter` (the two overlapped layers),
// `CompareHandle` (the draggable divider, an ARIA slider) and `CompareDivider` (a decorative line for inside the handle).
// Behaviour + motion: `./behaviour.ts` (house motion `@rivetjs/cdk/motion`, embla-carousel 8.6.0 physics, MIT,
// © David Jerleke).
// - DOM: root `div[data-rv-compare]` (`rv-Compare`; inline `position: relative; overflow: hidden`,
//   `--rv-compare-position`; `data-orientation`, `data-dragging`, `data-moving` while a settle animates, `data-disabled`)
//   > `div` before layer (`rv-CompareBefore`, in flow: it sizes the root) + `div` after layer (`rv-CompareAfter`;
//   inline `position: absolute; inset: 0; clip-path: inset(…)`) + `div[role=slider][data-rv-compare-handle]`
//   (`rv-CompareHandle`; inline position / translate / `touch-action: none`; `aria-valuenow` / min / max / valuetext,
//   `aria-orientation`, `aria-label` default "Comparison position"; `data-focus-visible`, `data-focused`, `data-hovered`,
//   `data-dragging`). The stylesheet sizes the handle (its cross-axis width = the hit area) and draws its children.
// - Resumable: state = plain signals (`createCompareState`, provided by `CompareContext`), handlers are inline arrows
//   calling `./behaviour.ts`; nothing runs before the first pointer / key event (the root carries `preload="visible"`:
//   the handler chunks are fetched while visible, so a cold drag follows at once).
import { untrack } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { createContext, useContext } from "@rivetjs/reactivity";
import { useLocale } from "../i18n/index.ts";
import { dataBool, focusStateIn, hoverStateOver, type InteractionStateOptions } from "../utils/data-attrs.tsx";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { liveOptions } from "../utils/live.tsx";
import {
  COMPARE_KEYS,
  compareAfterStyle,
  compareDispose,
  compareHandleStyle,
  compareKeyDown,
  comparePointerDown,
  comparePosition,
  compareRootStyle,
  compareValue,
  compareValueText,
  createCompareState,
  isCompareDisabled,
  type CompareMotionOptions,
  type CompareOrientation,
  type CompareState,
  type CompareStateOptions,
} from "./behaviour.ts";

export {
  COMPARE_DURATION,
  COMPARE_FRICTION,
  COMPARE_KEYS,
  compareDragEnd,
  comparePosition,
  compareSetValue,
  compareValue,
  compareValueAt,
  compareValueText,
  createCompareState,
  isCompareDisabled,
  type CompareMotionOptions,
  type CompareOrientation,
  type CompareState,
  type CompareStateOptions,
} from "./behaviour.ts";

/** The compare state of the nearest `Compare` (null outside one). */
export const CompareContext = createContext<CompareState | null>(null);

type Style = Record<string, string | number | undefined>;

export interface CompareProps extends Omit<CompareStateOptions, "direction" | "locale">, GlobalDOMAttributes<HTMLDivElement> {
  /** A state from `createCompareState` (else one is created from the props). */
  state?: CompareState;
  id?: string;
  /** @default "rv-Compare" */
  class?: string;
  /** Extra inline style (the behaviour styles win). */
  style?: Style;
  /** The layers and the handle. */
  children?: Content;
}

const ROOT_OWNED = ["onPointerDown", "style"] as const;

/** Root: provides the state to the parts; with `dragAnywhere` a press on the surface jumps there and drags. */
export function Compare(props: CompareProps) {
  const { locale, direction } = useLocale();
  // Live props: `value` (controlled) / `isDisabled` become accessors at the boundary; the rest is read once.
  const merged = liveOptions(props, ["isDisabled"], ["value"]);
  return untrack(() => compareRoot(merged, locale, direction));
}

function compareRoot(props: CompareProps, locale: string, direction: "ltr" | "rtl") {
  const state =
    props.state ??
    createCompareState({
      value: props.value,
      defaultValue: props.defaultValue,
      onChange: props.onChange,
      onChangeEnd: props.onChangeEnd,
      orientation: props.orientation,
      isDisabled: props.isDisabled,
      step: props.step,
      pageStep: props.pageStep,
      dragAnywhere: props.dragAnywhere,
      animation: props.animation,
      direction: props.dir === "rtl" ? "rtl" : props.dir === "ltr" ? "ltr" : direction,
      locale,
    });
  const { id, children } = props;
  const className = props.class ?? "rv-Compare";
  const userStyle = props.style;
  const userPointerDown = props.onPointerDown as ((e: PointerEvent) => void) | undefined;
  const dom = globalDOMProps(props, ROOT_OWNED);
  return (
    <Provider token={CompareContext} value={state}>
      <div
        {...dom}
        id={id}
        class={className}
        data-rv-compare=""
        data-orientation={state.orientation}
        data-dragging={dataBool(state.dragging())}
        data-moving={dataBool(state.position() !== null)}
        data-disabled={dataBool(isCompareDisabled(state))}
        style={{ ...userStyle, ...compareRootStyle(state) }}
        preload="visible"
        onPointerDown={(event: PointerEvent) => {
          comparePointerDown(event, state, true);
          userPointerDown?.(event);
        }}
      >
        {children}
      </div>
    </Provider>
  );
}

export interface CompareLayerProps extends GlobalDOMAttributes<HTMLDivElement> {
  id?: string;
  /** @default "rv-CompareBefore" / "rv-CompareAfter" */
  class?: string;
  style?: Style;
  children?: Content;
}

/** The "before" layer: in flow (it sizes the compare), shown on the start side of the divider. */
export function CompareBefore(props: CompareLayerProps) {
  const state = useContext(CompareContext);
  const { id, children } = props;
  const className = props.class ?? "rv-CompareBefore";
  const style = props.style;
  const dom = globalDOMProps(props, ["style"]);
  return (
    <div {...dom} id={id} class={className} data-rv-compare-before="" data-orientation={state?.orientation} style={style}>
      {children}
    </div>
  );
}

/** The "after" layer: absolutely stacked over the before layer, clipped to the end side of the divider (inline clip-path). */
export function CompareAfter(props: CompareLayerProps) {
  const state = useContext(CompareContext);
  const { id, children } = props;
  const className = props.class ?? "rv-CompareAfter";
  const style = props.style;
  const dom = globalDOMProps(props, ["style"]);
  return (
    <div
      {...dom}
      id={id}
      class={className}
      data-rv-compare-after=""
      data-orientation={state?.orientation}
      style={state ? { ...style, ...compareAfterStyle(state) } : style}
    >
      {children}
    </div>
  );
}

export interface CompareHandleProps extends GlobalDOMAttributes<HTMLDivElement> {
  id?: string;
  /** @default "rv-CompareHandle" */
  class?: string;
  style?: Style;
  /** @default "Comparison position" */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  /** Overrides the default percent text (a string, or an accessor of the value). */
  "aria-valuetext"?: string | ((value: number) => string);
  /** Runs after the handle's own key handling (native `KeyboardEvent`). */
  onKeyDown?: (event: KeyboardEvent) => void;
  /** The handle's look (divider line, grip). */
  children?: Content;
}

const HANDLE_OWNED = ["onPointerDown", "onPointerOver", "onKeyDown", "style"] as const;

/** The divider handle: an ARIA slider (focusable, keys) that a pointer drags. */
export function CompareHandle(props: CompareHandleProps) {
  const state = useContext(CompareContext);
  const { id, children } = props;
  const className = props.class ?? "rv-CompareHandle";
  const style = props.style;
  const labelledBy = props["aria-labelledby"];
  const label = props["aria-label"] ?? (labelledBy ? undefined : "Comparison position");
  const describedBy = props["aria-describedby"];
  const valueText = props["aria-valuetext"];
  const userDown = props.onPointerDown as ((e: PointerEvent) => void) | undefined;
  const userOver = props.onPointerOver as ((e: PointerEvent) => void) | undefined;
  const userKey = props.onKeyDown as ((e: KeyboardEvent) => void) | undefined;
  const dom = globalDOMProps(props, HANDLE_OWNED);
  const interaction: InteractionStateOptions = {};
  if (!state) return null;
  return (
    <div
      {...dom}
      id={id}
      class={className}
      role="slider"
      tabIndex={isCompareDisabled(state) ? undefined : 0}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-orientation={state.orientation}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(compareValue(state))}
      aria-valuetext={typeof valueText === "function" ? valueText(compareValue(state)) : (valueText ?? compareValueText(state))}
      aria-disabled={isCompareDisabled(state) ? "true" : undefined}
      data-rv-compare-handle=""
      data-rk={COMPARE_KEYS}
      data-orientation={state.orientation}
      data-dragging={dataBool(state.dragging())}
      data-disabled={dataBool(isCompareDisabled(state))}
      style={{ ...style, ...compareHandleStyle(state) }}
      onPointerDown={(event: PointerEvent) => {
        comparePointerDown(event, state, false);
        userDown?.(event);
      }}
      onPointerOver={(event: PointerEvent) => {
        hoverStateOver(interaction, event);
        userOver?.(event);
      }}
      onFocusIn={(event: FocusEvent) => focusStateIn(interaction, event)}
      onKeyDown={(event: KeyboardEvent) => {
        compareKeyDown(event, state);
        userKey?.(event);
      }}
    >
      {children}
    </div>
  );
}

export interface CompareDividerProps extends GlobalDOMAttributes<HTMLSpanElement> {
  id?: string;
  /** @default "rv-CompareDivider" */
  class?: string;
  style?: Style;
}
export function CompareDivider(props: CompareDividerProps) {
  const state = useContext(CompareContext);
  const className = props.class ?? "rv-CompareDivider";
  const dom = globalDOMProps(props, ["style"]);
  return (
    <span {...dom} id={props.id} class={className} aria-hidden="true" data-rv-compare-divider="" data-orientation={state?.orientation} style={props.style} />
  );
}

/** The divider position (percent) of the nearest `Compare`, as an accessor (the settle position while it animates). */
export function useComparePosition(): () => number {
  const state = useContext(CompareContext);
  return () => (state ? comparePosition(state) : 50);
}
