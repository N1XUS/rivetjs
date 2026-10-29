// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no stepper). Feature set (parts, prop names / defaults, data
// attributes, CSS variable names) scoped from public docs of commercial UI kits; independent implementation. Behaviour =
// `@rivetjs/cdk/stepper` (port of Angular CDK stepper, MIT, © Google LLC) in its `list` semantics; look = HeroUI tokens
// (vendored-format tv slots in `styles/src/components/stepper/`, BEM CSS `styles/components/stepper.css`, both Rivet-authored).
// Rivet:
// - `Stepper` = cdk `Stepper semantics="list"` (`ol`, `aria-current="step"` on the current `li`); interactive only with
//   `onStepChange` (or a two-way Signal `currentStep`): otherwise the cdk read-only mode (plain `div` headers, "Display Only").
// - `Stepper.Step` = cdk `Step` (`li`) + cdk `StepHeader` (`button.stepper__step-button[data-clickable]`, or a `div`
//   read-only) wrapping the step's children; `data-status` (inactive / active / complete) is index-based: steps before the
//   current one are complete.
// - Default indicator content: the step number, lucide `Check` (stroke draw-in, CSS) once complete — in a `Show`, so the
//   check is created once per completion (a current-step change never redraws earlier checks); `Stepper.Icon` without
//   children = a bullet dot (CSS `:empty`).
// - `Stepper.Separator` `progress` 0–1 (default: 1 when the step is complete, else 0) drives a CSS `transform` transition
//   (`motion-reduce` disables it); hidden on the last step by CSS (`:last-child`) unless `force`.
// - Step children may be a function `({ index, status, isLast }) => …` (accessors), = `useStepperStep()`.
// - Shorthand (identity spec §4.2, plan T22): a Step without children and with `title` (+ `description`) renders
//   Indicator + Content(Title, Description) + Separator.
// - Live props: `class` on every part is read lazily (`splitLive`); `currentStep` live → an accessor for the cdk state.
//   `orientation` / `size` are read once (the cdk state + list markup are created once).
import { Icon } from "@rivetjs/kit/icon";
import {
  Step as StepPrimitive,
  StepHeader,
  Stepper as StepperPrimitive,
  StepContext,
  StepperContext,
  stepperSelectedIndex,
  useStep,
} from "@rivetjs/cdk/stepper";
import type { StepProps as CdkStepProps, StepRenderProps, StepperOrientation, StepperProps as CdkStepperProps, StepperRenderProps } from "@rivetjs/cdk/stepper";
import { createContext, useContext, type Signal } from "@rivetjs/reactivity";
import { Provider, Show } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { isSlot } from "@rivetjs/runtime/slot";
import { Check } from "lucide";

import type { StepperVariants } from "../../../styles/src/components/stepper/index.ts";
import { stepperVariants } from "../../../styles/src/components/stepper/index.ts";
import { composeSlotClassName } from "../../utils/compose.tsx";
import { hasLiveProp, splitLive } from "../../utils/live.tsx";
import { DEV } from "#dev";

/* ------------------------------------------------------------------------------------------------
 * Context
 * --------------------------------------------------------------------------------------------- */
type StepperUiContext = {
  /** Set by `Stepper`. */
  inStepper?: boolean;
};

const StepperUiContext = createContext<StepperUiContext>({});

type StepperSlots = ReturnType<typeof stepperVariants>;
let SLOTS: StepperSlots | undefined;
/** Element slots do not depend on variants (modifiers sit on the root class only): one module-level slots object. */
const slots = (): StepperSlots => (SLOTS ??= stepperVariants({}));

const ROOT_CONTEXT: StepperUiContext = { inStepper: true };

const dataAttr = (condition: boolean | undefined): "true" | undefined => (condition ? "true" : undefined);

/* ------------------------------------------------------------------------------------------------
 * Step status
 * --------------------------------------------------------------------------------------------- */
/** Status of a step relative to the current one. */
export type StepperStepStatus = "inactive" | "active" | "complete";

/** The nearest step's index, status and last-ness (accessors). */
export interface StepperStepState {
  /** Zero-based index. */
  index: () => number;
  /** `complete` before the current step, `active` for it, `inactive` after it. `[data-status]` */
  status: () => StepperStepStatus;
  /** Whether this is the last step (exact once every step rendered: client side; server: `false`). */
  isLast: () => boolean;
}

const statusOf = (index: number, current: number): StepperStepStatus => (index < current ? "complete" : index === current ? "active" : "inactive");

/** The nearest `Stepper.Step`'s state (throws outside one). */
export function useStepperStep(): StepperStepState {
  const step = useStep();
  // The step context carries its stepper (the server renders nested providers' children later: read it from the nearest one).
  const stepper = useContext(StepContext)!.stepper;
  return {
    index: () => step.index(),
    status: () => statusOf(step.index(), stepperSelectedIndex(stepper)),
    isLast: () => step.isLast(),
  };
}

/* -------------------------------------------------------------------------------------------------
 * Stepper Root
 * -----------------------------------------------------------------------------------------------*/
interface StepperRootProps extends StepperVariants {
  /** Layout direction. @default "horizontal" */
  orientation?: StepperOrientation;
  /** Index of the current step (controlled): a value (live prop), a two-way Signal or an accessor. */
  currentStep?: number | Signal<number> | (() => number);
  /** Initial step (uncontrolled). @default 0 */
  defaultStep?: number;
  /** Called with the clicked step's index; makes the steps interactive (buttons). */
  onStepChange?: (index: number) => void;
  class?: string;
  style?: CdkStepperProps["style"];
  id?: string;
  children?: Content;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  [attribute: `data-${string}`]: unknown;
}

const StepperRoot = (props: StepperRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "orientation", "size", "currentStep", "defaultStep", "onStepChange"]);
  const orientation = local.orientation ?? "horizontal";
  const size = local.size ?? "md";
  const classOf = () => stepperVariants({ orientation, size }).base({ class: local.class });
  const cls = hasLiveProp(local, ["class"]) ? (_values: StepperRenderProps) => classOf() : classOf();
  // A Signal / accessor (also handed through a parent's prop getter) goes to the cdk as is; a live number → an accessor;
  // undefined (also a forwarded unset prop) = uncontrolled.
  const initial = local.currentStep;
  const current =
    initial === undefined || typeof initial === "function" ? initial : hasLiveProp(local, ["currentStep"]) ? () => local.currentStep as number : initial;
  const onStepChange = local.onStepChange;
  const interactive = !!onStepChange || (typeof current === "function" && typeof (current as Signal<number>).set === "function");
  // A function: Rivet JSX builds nodes eagerly, the parts must be created inside the provider.
  const content = () => (
    <StepperPrimitive
      data-slot="stepper"
      {...rest}
      semantics="list"
      isReadOnly={!interactive}
      orientation={orientation}
      selectedIndex={current as StepperRootProps["currentStep"]}
      defaultSelectedIndex={local.defaultStep ?? 0}
      onSelectedIndexChange={onStepChange ? (index: number) => onStepChange(index) : undefined}
      class={cls as never}
    >
      {local.children}
    </StepperPrimitive>
  );
  return (
    <Provider token={StepperUiContext} value={ROOT_CONTEXT}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Stepper Step
 * -----------------------------------------------------------------------------------------------*/
interface StepperStepProps {
  /** Step content (Indicator / Content / Separator), or a function of the step state. */
  children?: Content | ((state: StepperStepState) => Content);
  class?: string;
  style?: CdkStepProps["style"];
  id?: string;
  /** Accessible name of the step button (default: its text content). */
  "aria-label"?: string;
  /** Classes of the inner step button. */
  buttonClass?: string;
  /** Shorthand (no children): the step Title; the Indicator, Content and Separator render too. */
  title?: Content;
  /** Shorthand (no children): the step Description under the Title. */
  description?: Content;
  [attribute: `data-${string}`]: unknown;
}

const StepperStep = (props: StepperStepProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "buttonClass", "aria-label", "title", "description"]);
  if (DEV && local.children !== undefined) DEV.shorthandIgnored("Stepper.Step", local, ["title", "description"]);
  const stepper = useContext(StepperContext)!;
  const interactive = !stepper.readOnly;
  const status = (values: StepRenderProps) => statusOf(values.index(), stepperSelectedIndex(stepper));
  const children = local.children;
  const body = () =>
    children === undefined && local.title !== undefined ? (
      <>
        <StepperIndicator />
        <StepperContent>
          <StepperTitle>{local.title}</StepperTitle>
          {local.description !== undefined && <StepperDescription>{local.description}</StepperDescription>}
        </StepperContent>
        <StepperSeparator />
      </>
    ) : typeof children === "function" && !isSlot(children) ? (
      (children as (state: StepperStepState) => Content)(useStepperStep())
    ) : (
      (children as Content)
    );
  return (
    <StepPrimitive
      {...rest}
      render={(attrs, values) => (
        <li {...(attrs as {})} class={composeSlotClassName(slots().step, local.class)} data-slot="stepper-step" data-status={status(values)} />
      )}
    >
      <StepHeader
        class={composeSlotClassName(slots().stepButton, local.buttonClass)}
        data-slot="stepper-step-button"
        data-clickable={dataAttr(interactive)}
        aria-label={local["aria-label"]}
      >
        {body()}
      </StepHeader>
    </StepPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Stepper Indicator
 * -----------------------------------------------------------------------------------------------*/
interface StepperIndicatorProps extends Omit<JSX.IntrinsicElements["span"], "children"> {
  /** Replaces the default number / check. */
  children?: Content;
  class?: string;
}

const StepperIndicator = (props: StepperIndicatorProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const step = useStepperStep();
  const hasChildren = "children" in props && props.children !== undefined;
  return (
    <span {...rest} class={composeSlotClassName(slots().indicator, local.class)} data-slot="stepper-indicator" data-status={step.status()} aria-hidden="true">
      {/* `Show` (truthiness memo), not a ternary: a ternary child re-runs on every current-step change and would re-create
          the check of every completed step (replaying its stroke draw). */}
      {hasChildren ? (
        local.children
      ) : (
        <Show when={step.status() === "complete"} fallback={<>{step.index() + 1}</>}>
          {() => <Icon icon={Check} size={16} stroke-width={3} data-slot="stepper-check" />}
        </Show>
      )}
    </span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Stepper Icon / Content / Title / Description
 * -----------------------------------------------------------------------------------------------*/
interface StepperTextProps extends Omit<JSX.IntrinsicElements["span"], "children"> {
  children?: Content;
  class?: string;
}

/** An icon inside the indicator; without children a bullet dot. */
const StepperIcon = (props: StepperTextProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <span {...rest} class={composeSlotClassName(slots().icon, local.class)} data-slot="stepper-icon">
      {local.children}
    </span>
  );
};

const StepperContent = (props: StepperTextProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <span {...rest} class={composeSlotClassName(slots().content, local.class)} data-slot="stepper-content">
      {local.children}
    </span>
  );
};

const StepperTitle = (props: StepperTextProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <span {...rest} class={composeSlotClassName(slots().title, local.class)} data-slot="stepper-title">
      {local.children}
    </span>
  );
};

const StepperDescription = (props: StepperTextProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  return (
    <span {...rest} class={composeSlotClassName(slots().description, local.class)} data-slot="stepper-description">
      {local.children}
    </span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Stepper Separator
 * -----------------------------------------------------------------------------------------------*/
interface StepperSeparatorProps extends Omit<JSX.IntrinsicElements["span"], "children"> {
  /** Fill 0–1. Default: 1 when the step is complete, else 0. */
  progress?: number;
  /** Render on the last step too. */
  force?: boolean;
  class?: string;
}

const StepperSeparator = (props: StepperSeparatorProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["class", "progress", "force"]);
  const step = useStepperStep();
  const progress = () => {
    const p = local.progress;
    return p === undefined ? (step.status() === "complete" ? 1 : 0) : Math.min(1, Math.max(0, p));
  };
  return (
    <span
      {...rest}
      class={composeSlotClassName(slots().separator, local.class)}
      data-slot="stepper-separator"
      data-force={dataAttr(local.force)}
      aria-hidden="true"
    >
      <span class={slots().separatorTrack()} data-slot="stepper-separator-track" data-complete={dataAttr(progress() >= 1)}>
        <span class={slots().separatorFill()} data-slot="stepper-separator-fill" style={{ "--stepper-separator-progress": String(progress()) }} />
      </span>
    </span>
  );
};

export { StepperRoot, StepperStep, StepperIndicator, StepperIcon, StepperContent, StepperTitle, StepperDescription, StepperSeparator, StepperUiContext };
export type { StepperRootProps, StepperStepProps, StepperIndicatorProps, StepperTextProps, StepperSeparatorProps };
