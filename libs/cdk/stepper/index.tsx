// Ported from Angular CDK stepper (src/cdk/stepper/{stepper.ts,step-header.ts,step-label.ts,stepper-button.ts}, v22.2.2)
// + the accessible markup of Angular Material's stepper (src/material/stepper/stepper.html), MIT, © Google LLC.
// A wizard-like workflow divided into steps: `Stepper` (state + root) > `StepList` (header strip) > `Step` (one step:
// state, context) > `StepHeader` (selects the step) / `StepLabel`; `StepPanel` (the step's content); `StepperNext` /
// `StepperPrevious` buttons. State machine + keyboard = `./state.ts`.
// Rivet:
// - components instead of directives: `CdkStepper` → `Stepper` (+ `StepList`: Material's header container),
//   `CdkStep` → `Step`, `CdkStepHeader` → `StepHeader`, `CdkStepLabel` → `StepLabel`, Material's content containers →
//   `StepPanel`, `CdkStepperNext` / `CdkStepperPrevious` → `StepperNext` / `StepperPrevious` (cdk `Button`, `type`
//   default `"submit"` / `"button"` as upstream). RAC-style render props (accessors), `class` / `style` functions,
//   `render` (DOMRenderProps), `*Context` tokens (`rv-stepper`, `rv-step`), `GlobalDOMAttributes` on every part.
// - ARIA (upstream recommends Material's tabbed view): `semantics="tabs"` (default) = Material: horizontal → `StepList`
//   `role="tablist"` + `aria-orientation`, headers `role="tab"` + `aria-selected` + `aria-controls`, panels `tabpanel`;
//   vertical → headers `role="button"` + `aria-expanded` + `aria-current="step"`, panels `role="region"`; roving
//   tabindex (the selected / last focused header), non-navigable headers `aria-disabled="true"`, arrow keys (+ Home /
//   End, wrap, RTL) through `stepperHeaderKeyDown`, Enter / Space select. Rivet `semantics="list"` = an ordered list
//   (`Stepper` → `ol`, `Step` → `li` with `aria-current="step"`), headers are native `<button type="button">`s in the
//   Tab order (progress indicators / timelines without panels); `isReadOnly` renders them as plain `div`s.
// - `aria-posinset` / `aria-setsize` are not written (Material does): the set size is unknown while the server renders
//   the first steps; browsers derive both from the tabs inside the tablist (step wrappers are generic elements).
// - inactive panels are `hidden` + `inert` (Material: `inert` + CSS); `data-position` (`previous` / `current` /
//   `next`, RTL-aware, upstream `_getAnimationDirection`) on every panel for transitions.
// - resumable: nothing runs at load (no effect, no listener); the root carries `preload="visible"` (its handlers +
//   the bindings they update are fetched / evaluated when the stepper is visible, so the first click / key is
//   synchronous on slow networks).
import { createContext, onCleanup, provide, untrack, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import { Button, type ButtonProps } from "../button/index.tsx";
import { useLocale } from "../i18n/index.ts";
import { dataBool, focusStateBlur, focusStateFocus, hoverStateEnter, hoverStateLeave } from "../utils/data-attrs.tsx";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { createId } from "../utils/id.ts";
import type { DOMRenderProps } from "../utils/render.ts";
import { renderProps as resolveRenderProps, type RefValue, type RenderProps } from "../slots/index.tsx";
import {
  createStepState,
  createStepperState,
  markStepInteracted,
  registerStep,
  selectStep,
  stepCompleted,
  stepContentId,
  stepContentPosition,
  stepCount,
  stepEditable,
  stepHasError,
  stepIndex,
  stepIndicatorType,
  stepIsLast,
  stepIsNavigable,
  stepIsSelected,
  stepLabelId,
  stepOptional,
  stepperFocusIndex,
  stepperHeaderKeyDown,
  stepperKeys,
  stepperNext,
  stepperOrientation,
  stepperPrevious,
  stepperReset,
  stepperSelectedIndex,
  stepShowError,
  unregisterStep,
  type StepContentPositionState,
  type StepItemState,
  type StepperOrientation,
  type StepperState,
  type StepperStateProps,
  type StepState,
  type StepStateProps,
} from "./state.ts";

export * from "./state.ts";

// =================================================================================================
// Contexts
// =================================================================================================

/** The state of the nearest `Stepper` (`null` outside one). */
export const StepperContext = createContext<StepperState | null>(null);

/** The nearest `Step`: its stepper + state (`null` outside one). */
export interface StepContextValue {
  stepper: StepperState;
  step: StepItemState;
}
export const StepContext = createContext<StepContextValue | null>(null);

/** The nearest stepper's API (throws outside a `Stepper`): accessors + actions (upstream `CdkStepper` methods). */
export interface StepperApi {
  state: StepperState;
  selectedIndex: () => number;
  stepCount: () => number;
  orientation: () => StepperOrientation;
  select: (index: number) => void;
  next: () => void;
  previous: () => void;
  reset: () => void;
}

/** The nearest `Stepper`'s API. */
export function useStepper(): StepperApi {
  const state = useContext(StepperContext);
  if (!state) throw new Error("useStepper must be used within a Stepper.");
  return {
    state,
    selectedIndex: () => stepperSelectedIndex(state),
    stepCount: () => stepCount(state),
    orientation: () => stepperOrientation(state),
    select: (index: number) => selectStep(state, index),
    next: () => stepperNext(state),
    previous: () => stepperPrevious(state),
    reset: () => stepperReset(state),
  };
}

/** Render props of a step (accessors). */
export interface StepRenderProps {
  /** Zero-based index. `[data-index]` */
  index: () => number;
  /** Whether the step is selected. `[data-selected]` */
  isSelected: () => boolean;
  /** Whether the step is completed (upstream `completed`). `[data-completed]` */
  isCompleted: () => boolean;
  /** Whether the step has an error that is shown (`showError`). `[data-invalid]` */
  hasError: () => boolean;
  /** Whether the user can navigate to the step. `[data-disabled]` when not. */
  isNavigable: () => boolean;
  /** `[data-optional]` */
  isOptional: () => boolean;
  /** `[data-editable]` */
  isEditable: () => boolean;
  /** Whether this is the last registered step (exact once every step rendered: client side). */
  isLast: () => boolean;
  /** Indicator type (upstream `indicatorType`: number / edit / done / error / custom). `[data-state]` */
  state: () => StepState;
  /** Orientation of the stepper. `[data-orientation]` */
  orientation: () => StepperOrientation;
}

/** The nearest `Step`'s render props (throws outside a `Step`). */
export function useStep(): StepRenderProps {
  const ctx = useContext(StepContext);
  if (!ctx) throw new Error("useStep must be used within a Step.");
  return stepValues(ctx.stepper, ctx.step);
}

function stepValues(stepper: StepperState, step: StepItemState): StepRenderProps {
  return {
    index: () => stepIndex(stepper, step),
    isSelected: () => stepIsSelected(stepper, step),
    isCompleted: () => stepCompleted(step),
    hasError: () => stepShowError(stepper, step) && stepHasError(step),
    isNavigable: () => stepIsNavigable(stepper, step),
    isOptional: () => stepOptional(step),
    isEditable: () => stepEditable(step),
    isLast: () => stepIsLast(stepper, step),
    state: () => stepIndicatorType(stepper, step),
    orientation: () => stepperOrientation(stepper),
  };
}

function stepperOf(): StepperState {
  const state = useContext(StepperContext);
  if (!state) throw new Error("Stepper parts must be used within a Stepper.");
  return state;
}

function stepOf(part: string): StepContextValue {
  const ctx = useContext(StepContext);
  if (!ctx) throw new Error(`${part} must be used within a Step.`);
  return ctx;
}

interface PartProps<E extends Element> extends GlobalDOMAttributes<E> {
  id?: string;
  ref?: RefValue<E>;
  [attribute: `aria-${string}`]: unknown;
}

// =================================================================================================
// Stepper
// =================================================================================================

/** Render props of the stepper (accessors). */
export interface StepperRenderProps {
  /** `[data-selected-index]` */
  selectedIndex: () => number;
  stepCount: () => number;
  /** `[data-orientation]` */
  orientation: () => StepperOrientation;
}

export interface StepperProps extends StepperStateProps, RenderProps<StepperRenderProps>, DOMRenderProps<"div", StepperRenderProps>, PartProps<HTMLElement> {}

/** The stepper root: owns the state (upstream `CdkStepper`). `div` (tabs semantics) or `ol` (list semantics). */
export function Stepper(props: StepperProps) {
  const { class: cls, style, children, render, ref } = props;
  const id = props.id ?? createId();
  const state = createStepperState(id, props);
  const values: StepperRenderProps = {
    selectedIndex: () => stepperSelectedIndex(state),
    stepCount: () => stepCount(state),
    orientation: () => stepperOrientation(state),
  };
  const rp = resolveRenderProps({ class: cls, style, children, values, defaultClassName: "rv-Stepper" });
  const dom = globalDOMProps(props, ["style"]);
  const list = state.semantics === "list";
  const ariaLabel = props["aria-label"] as string | undefined;
  const ariaLabelledby = props["aria-labelledby"] as string | undefined;
  const readOnly = state.readOnly;
  if (render) {
    const attrs = {
      ...dom,
      ref,
      id,
      "aria-label": list ? ariaLabel : undefined,
      "aria-labelledby": list ? ariaLabelledby : undefined,
      class: () => rp.class(),
      style: () => rp.style(),
      "data-rv-stepper": id,
      "data-orientation": () => stepperOrientation(state),
      "data-selected-index": () => stepperSelectedIndex(state),
      "data-readonly": dataBool(readOnly),
      children: () => (
        <Provider token={StepperContext} value={state}>
          {rp.children()}
        </Provider>
      ),
    };
    return render(attrs as never, values);
  }
  if (list) {
    return (
      <ol
        {...dom}
        ref={ref as never}
        id={id}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        class={rp.class()}
        style={rp.style()}
        data-rv-stepper={id}
        data-orientation={stepperOrientation(state)}
        data-selected-index={stepperSelectedIndex(state)}
        data-readonly={dataBool(readOnly)}
        preload="visible"
      >
        {provide(StepperContext, state, () => rp.children())}
      </ol>
    );
  }
  return (
    <div
      {...dom}
      ref={ref as never}
      id={id}
      class={rp.class()}
      style={rp.style()}
      data-rv-stepper={id}
      data-orientation={stepperOrientation(state)}
      data-selected-index={stepperSelectedIndex(state)}
      preload="visible"
    >
      {provide(StepperContext, state, () => rp.children())}
    </div>
  );
}

// =================================================================================================
// StepList
// =================================================================================================

export interface StepListProps extends RenderProps<StepperRenderProps>, DOMRenderProps<"div", StepperRenderProps>, PartProps<HTMLDivElement> {}

/**
 * The header strip (Material's header container): `role="tablist"` + `aria-orientation` for a horizontal tabs
 * stepper, a plain `div` otherwise. `aria-label` / `aria-labelledby` land here.
 */
export function StepList(props: StepListProps) {
  const state = stepperOf();
  const { class: cls, style, children, render, ref } = props;
  const values: StepperRenderProps = {
    selectedIndex: () => stepperSelectedIndex(state),
    stepCount: () => stepCount(state),
    orientation: () => stepperOrientation(state),
  };
  const rp = resolveRenderProps({ class: cls, style, children, values, defaultClassName: "rv-StepList" });
  const dom = globalDOMProps(props, ["style"]);
  const tabs = state.semantics === "tabs";
  const ariaLabel = props["aria-label"] as string | undefined;
  const ariaLabelledby = props["aria-labelledby"] as string | undefined;
  const id = props.id;
  const role = () => (tabs && stepperOrientation(state) === "horizontal" ? "tablist" : undefined);
  if (render) {
    const attrs = {
      ...dom,
      ref,
      id,
      role: () => role(),
      "aria-orientation": () => (role() ? "horizontal" : undefined),
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledby,
      class: () => rp.class(),
      style: () => rp.style(),
      "data-orientation": () => stepperOrientation(state),
      children: () => rp.children(),
    };
    return render(attrs as never, values);
  }
  return (
    <div
      {...dom}
      ref={ref as never}
      id={id}
      role={role()}
      aria-orientation={role() ? "horizontal" : undefined}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      class={rp.class()}
      style={rp.style()}
      data-orientation={stepperOrientation(state)}
    >
      {rp.children()}
    </div>
  );
}

// =================================================================================================
// Step
// =================================================================================================

export interface StepProps extends StepStateProps, RenderProps<StepRenderProps>, DOMRenderProps<"div", StepRenderProps>, PartProps<HTMLElement> {}

/** One step (upstream `CdkStep`): registers with the stepper, provides `StepContext`. `div` or `li` (list semantics). */
export function Step(props: StepProps) {
  const stepper = stepperOf();
  const { class: cls, style, children, render, ref } = props;
  const step = createStepState(props);
  registerStep(stepper, step);
  // Upstream ngAfterViewInit: a linear stepper starting past this step marks it visited (navigable back to).
  untrack(() => {
    if ((typeof stepper.linear === "function" ? stepper.linear() : stepper.linear) && stepper.steps().indexOf(step) < stepper.selected.value())
      markStepInteracted(step);
  });
  onCleanup(() => unregisterStep(stepper, step));
  const values = stepValues(stepper, step);
  const rp = resolveRenderProps({ class: cls, style, children, values, defaultClassName: "rv-Step" });
  const dom = globalDOMProps(props, ["style"]);
  const list = stepper.semantics === "list";
  const ctx: StepContextValue = { stepper, step };
  if (render) {
    const attrs = {
      ...dom,
      ref,
      id: props.id,
      class: () => rp.class(),
      style: () => rp.style(),
      "aria-current": () => (list && values.isSelected() ? "step" : undefined),
      "data-index": () => values.index(),
      "data-selected": () => dataBool(values.isSelected()),
      "data-completed": () => dataBool(values.isCompleted()),
      "data-invalid": () => dataBool(values.hasError()),
      "data-disabled": () => dataBool(!values.isNavigable()),
      "data-optional": () => dataBool(values.isOptional()),
      "data-editable": () => dataBool(values.isEditable()),
      "data-state": () => values.state(),
      "data-orientation": () => values.orientation(),
      children: () => (
        <Provider token={StepContext} value={ctx}>
          {rp.children()}
        </Provider>
      ),
    };
    return render(attrs as never, values);
  }
  if (list) {
    return (
      <li
        {...dom}
        ref={ref as never}
        id={props.id}
        class={rp.class()}
        style={rp.style()}
        aria-current={values.isSelected() ? "step" : undefined}
        data-index={values.index()}
        data-selected={dataBool(values.isSelected())}
        data-completed={dataBool(values.isCompleted())}
        data-invalid={dataBool(values.hasError())}
        data-disabled={dataBool(!values.isNavigable())}
        data-optional={dataBool(values.isOptional())}
        data-editable={dataBool(values.isEditable())}
        data-state={values.state()}
        data-orientation={values.orientation()}
      >
        {provide(StepContext, ctx, () => rp.children())}
      </li>
    );
  }
  return (
    <div
      {...dom}
      ref={ref as never}
      id={props.id}
      class={rp.class()}
      style={rp.style()}
      data-index={values.index()}
      data-selected={dataBool(values.isSelected())}
      data-completed={dataBool(values.isCompleted())}
      data-invalid={dataBool(values.hasError())}
      data-disabled={dataBool(!values.isNavigable())}
      data-optional={dataBool(values.isOptional())}
      data-editable={dataBool(values.isEditable())}
      data-state={values.state()}
      data-orientation={values.orientation()}
    >
      {provide(StepContext, ctx, () => rp.children())}
    </div>
  );
}

// =================================================================================================
// StepHeader
// =================================================================================================

/** Render props of a header (the step's, + interaction states as attributes). */
export type StepHeaderRenderProps = StepRenderProps;

export interface StepHeaderProps extends RenderProps<StepHeaderRenderProps>, DOMRenderProps<"div", StepHeaderRenderProps>, PartProps<HTMLElement> {}

/** Global DOM events the header handles itself (its handler runs first, then the user's). */
const HEADER_OWNED = ["onClick", "onPointerEnter", "onPointerLeave", "style"] as const;

/**
 * The step's header (upstream `CdkStepHeader` + Material's header attributes): click / Enter / Space select the step
 * (validation permitting), arrows move focus between headers (tabs semantics). Default content: the step `label`.
 */
export function StepHeader(props: StepHeaderProps) {
  const { stepper, step } = stepOf("StepHeader");
  const { class: cls, style, children, render, ref, onClick, onPointerEnter, onPointerLeave } = props;
  const values = stepValues(stepper, step);
  const rp = resolveRenderProps({ class: cls, style, children, values, defaultClassName: "rv-StepHeader", defaultChildren: step.label });
  const dom = globalDOMProps(props, HEADER_OWNED);
  const direction = useLocale().direction;
  const list = stepper.semantics === "list";
  const ariaLabel = props["aria-label"] as string | undefined;
  const ariaLabelledby = ariaLabel ? undefined : (props["aria-labelledby"] as string | undefined);
  const readOnly = stepper.readOnly;
  const interaction = {};
  const vertical = () => stepperOrientation(stepper) === "vertical";
  if (render) {
    const attrs = {
      ...dom,
      ref,
      id: () => stepLabelId(stepper, values.index()),
      type: list && !readOnly ? "button" : undefined,
      role: () => (list ? undefined : vertical() ? "button" : "tab"),
      tabindex: () => (list ? undefined : stepperFocusIndex(stepper) === values.index() ? 0 : -1),
      "aria-selected": () => (list || vertical() ? undefined : values.isSelected() ? "true" : "false"),
      "aria-current": () => (!list && vertical() && values.isSelected() ? "step" : undefined),
      "aria-expanded": () => (!list && vertical() ? (values.isSelected() ? "true" : "false") : undefined),
      "aria-controls": () => (list ? undefined : stepContentId(stepper, values.index())),
      "aria-disabled": () => (readOnly || values.isNavigable() ? undefined : "true"),
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledby,
      class: () => rp.class(),
      style: () => rp.style(),
      "data-rv-step-header": stepper.id,
      "data-rk": list ? undefined : stepperKeys(stepperOrientation(stepper)),
      "data-selected": () => dataBool(values.isSelected()),
      "data-completed": () => dataBool(values.isCompleted()),
      "data-invalid": () => dataBool(values.hasError()),
      "data-disabled": () => dataBool(!values.isNavigable()),
      "data-state": () => values.state(),
      onClick: (event: MouseEvent) => {
        if (!readOnly) selectStep(stepper, stepIndex(stepper, step));
        onClick?.(event as never);
      },
      onKeyDown: (event: KeyboardEvent) => {
        if (!list) stepperHeaderKeyDown(stepper, event, direction);
      },
      onPointerEnter: (event: PointerEvent) => {
        hoverStateEnter(interaction, event);
        onPointerEnter?.(event as never);
      },
      onPointerLeave: (event: PointerEvent) => {
        hoverStateLeave(interaction, event);
        onPointerLeave?.(event as never);
      },
      onFocus: (event: FocusEvent) => focusStateFocus(interaction, event),
      onBlur: (event: FocusEvent) => focusStateBlur(interaction, event),
      children: () => rp.children(),
    };
    return render(attrs as never, values);
  }
  if (readOnly) {
    return (
      <div
        {...dom}
        ref={ref as never}
        id={stepLabelId(stepper, values.index())}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        class={rp.class()}
        style={rp.style()}
        data-selected={dataBool(values.isSelected())}
        data-completed={dataBool(values.isCompleted())}
        data-invalid={dataBool(values.hasError())}
        data-state={values.state()}
      >
        {rp.children()}
      </div>
    );
  }
  if (list) {
    return (
      <button
        {...dom}
        ref={ref as never}
        type="button"
        id={stepLabelId(stepper, values.index())}
        aria-disabled={values.isNavigable() ? undefined : "true"}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledby}
        class={rp.class()}
        style={rp.style()}
        data-rv-step-header={stepper.id}
        data-selected={dataBool(values.isSelected())}
        data-completed={dataBool(values.isCompleted())}
        data-invalid={dataBool(values.hasError())}
        data-disabled={dataBool(!values.isNavigable())}
        data-state={values.state()}
        onClick={(event) => {
          selectStep(stepper, stepIndex(stepper, step));
          onClick?.(event as never);
        }}
        onPointerEnter={(event) => {
          hoverStateEnter(interaction, event);
          onPointerEnter?.(event as never);
        }}
        onPointerLeave={(event) => {
          hoverStateLeave(interaction, event);
          onPointerLeave?.(event as never);
        }}
        onFocus={(event) => focusStateFocus(interaction, event)}
        onBlur={(event) => focusStateBlur(interaction, event)}
      >
        {rp.children()}
      </button>
    );
  }
  return (
    <div
      {...dom}
      ref={ref as never}
      id={stepLabelId(stepper, values.index())}
      role={vertical() ? "button" : "tab"}
      tabIndex={stepperFocusIndex(stepper) === values.index() ? 0 : -1}
      aria-selected={vertical() ? undefined : values.isSelected() ? "true" : "false"}
      aria-current={vertical() && values.isSelected() ? "step" : undefined}
      aria-expanded={vertical() ? (values.isSelected() ? "true" : "false") : undefined}
      aria-controls={stepContentId(stepper, values.index())}
      aria-disabled={values.isNavigable() ? undefined : "true"}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledby}
      class={rp.class()}
      style={rp.style()}
      data-rv-step-header={stepper.id}
      data-rk={stepperKeys(stepperOrientation(stepper))}
      data-selected={dataBool(values.isSelected())}
      data-completed={dataBool(values.isCompleted())}
      data-invalid={dataBool(values.hasError())}
      data-disabled={dataBool(!values.isNavigable())}
      data-state={values.state()}
      onClick={(event) => {
        selectStep(stepper, stepIndex(stepper, step));
        onClick?.(event as never);
      }}
      onKeyDown={(event) => stepperHeaderKeyDown(stepper, event, direction)}
      onPointerEnter={(event) => {
        hoverStateEnter(interaction, event);
        onPointerEnter?.(event as never);
      }}
      onPointerLeave={(event) => {
        hoverStateLeave(interaction, event);
        onPointerLeave?.(event as never);
      }}
      onFocus={(event) => focusStateFocus(interaction, event)}
      onBlur={(event) => focusStateBlur(interaction, event)}
    >
      {rp.children()}
    </div>
  );
}

// =================================================================================================
// StepLabel
// =================================================================================================

export interface StepLabelProps extends RenderProps<StepRenderProps>, DOMRenderProps<"div", StepRenderProps>, PartProps<HTMLDivElement> {}

/** The step's label (upstream `CdkStepLabel`): a `div` inside the header, with the step's state attributes. */
export function StepLabel(props: StepLabelProps) {
  const { stepper, step } = stepOf("StepLabel");
  const { class: cls, style, children, render, ref } = props;
  const values = stepValues(stepper, step);
  const rp = resolveRenderProps({ class: cls, style, children, values, defaultClassName: "rv-StepLabel", defaultChildren: step.label });
  const dom = globalDOMProps(props, ["style"]);
  if (render) {
    const attrs = {
      ...dom,
      ref,
      id: props.id,
      class: () => rp.class(),
      style: () => rp.style(),
      "data-selected": () => dataBool(values.isSelected()),
      "data-invalid": () => dataBool(values.hasError()),
      children: () => rp.children(),
    };
    return render(attrs as never, values);
  }
  return (
    <div
      {...dom}
      ref={ref as never}
      id={props.id}
      class={rp.class()}
      style={rp.style()}
      data-selected={dataBool(values.isSelected())}
      data-invalid={dataBool(values.hasError())}
    >
      {rp.children()}
    </div>
  );
}

// =================================================================================================
// StepPanel
// =================================================================================================

/** Render props of a panel. */
export interface StepPanelRenderProps {
  index: () => number;
  isSelected: () => boolean;
  /** `[data-position]` */
  position: () => StepContentPositionState;
  orientation: () => StepperOrientation;
}

export interface StepPanelProps extends RenderProps<StepPanelRenderProps>, DOMRenderProps<"div", StepPanelRenderProps>, PartProps<HTMLDivElement> {
  /** Index of the step this panel belongs to; omit inside a `Step` (that step). */
  index?: number;
}

/**
 * The content of a step (Material's content containers): `role="tabpanel"` (horizontal) / `"region"` (vertical),
 * labelled by the header; hidden + inert unless its step is selected; `data-position` previous / current / next.
 */
export function StepPanel(props: StepPanelProps) {
  const stepper = stepperOf();
  const ctx = useContext(StepContext);
  const fixed = props.index;
  const owner = ctx?.stepper === stepper ? ctx.step : undefined;
  const { class: cls, style, children, render, ref } = props;
  const direction = useLocale().direction;
  const index = () => (fixed !== undefined ? fixed : owner ? stepIndex(stepper, owner) : -1);
  const values: StepPanelRenderProps = {
    index,
    isSelected: () => stepperSelectedIndex(stepper) === index(),
    position: () => stepContentPosition(stepper, index(), direction),
    orientation: () => stepperOrientation(stepper),
  };
  const rp = resolveRenderProps({ class: cls, style, children, values, defaultClassName: "rv-StepPanel" });
  const dom = globalDOMProps(props, ["style", "hidden", "inert"]);
  const tabs = stepper.semantics === "tabs";
  if (render) {
    const attrs = {
      ...dom,
      ref,
      id: () => stepContentId(stepper, index()),
      role: () => (!tabs ? undefined : stepperOrientation(stepper) === "vertical" ? "region" : "tabpanel"),
      "aria-labelledby": () => stepLabelId(stepper, index()),
      hidden: () => !values.isSelected() || undefined,
      inert: () => !values.isSelected() || undefined,
      class: () => rp.class(),
      style: () => rp.style(),
      "data-position": () => values.position(),
      "data-selected": () => dataBool(values.isSelected()),
      children: () => rp.children(),
    };
    return render(attrs as never, values);
  }
  return (
    <div
      {...dom}
      ref={ref as never}
      id={stepContentId(stepper, index())}
      role={!tabs ? undefined : stepperOrientation(stepper) === "vertical" ? "region" : "tabpanel"}
      aria-labelledby={stepLabelId(stepper, index())}
      hidden={!values.isSelected()}
      inert={!values.isSelected()}
      class={rp.class()}
      style={rp.style()}
      data-position={values.position()}
      data-selected={dataBool(values.isSelected())}
    >
      {rp.children()}
    </div>
  );
}

// =================================================================================================
// StepperNext / StepperPrevious
// =================================================================================================

export type StepperButtonProps = Omit<ButtonProps, "onPress"> & { onPress?: ButtonProps["onPress"] };

/** Moves to the next step (upstream `CdkStepperNext`; `type` default `"submit"`). */
export function StepperNext(props: StepperButtonProps) {
  const stepper = stepperOf();
  const userPress = props.onPress;
  return (
    <Button
      type="submit"
      {...props}
      onPress={(event) => {
        stepperNext(stepper);
        userPress?.(event);
      }}
    />
  );
}

/** Moves to the previous step (upstream `CdkStepperPrevious`; `type` default `"button"`). */
export function StepperPrevious(props: StepperButtonProps) {
  const stepper = stepperOf();
  const userPress = props.onPress;
  return (
    <Button
      type="button"
      {...props}
      onPress={(event) => {
        stepperPrevious(stepper);
        userPress?.(event);
      }}
    />
  );
}
