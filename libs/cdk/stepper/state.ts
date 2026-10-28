// Ported from Angular CDK stepper (src/cdk/stepper/stepper.ts `CdkStepper` / `CdkStep`, v22.2.2), MIT, © Google LLC.
// The step state machine: selected index (controlled / uncontrolled), linear mode (previous steps must be completed or
// optional), editable / optional / completed / error states, `stepControl` validation, interacted tracking, reset,
// indicator type, navigability, content position (animation direction) and the header key manager (FocusKeyManager:
// wrap, Home / End, vertical orientation for vertical steppers, RTL).
// Rivet:
// - serializable state (signals + plain data + the caller's callbacks) instead of directive instances: `CdkStepper`
//   → `createStepperState`, `CdkStep` → `createStepState`; methods → free functions (`selectStep`,
//   `stepperNext`, `stepperPrevious`, `stepperReset`, `stepCompleted`, `stepIndicatorType`, …). No closures are created
//   here (a `.ts` module is not resumable); read the functions inside bindings / handlers of the `.tsx` parts.
// - `ContentChildren(CdkStep)` → steps register in creation order (`registerStep`; server render order = DOM order)
//   and unregister on disposal; a step's index is its position in `state.steps` (read in bindings: removal re-indexes).
// - `StepControl` = an object of accessors / booleans (`{ valid, invalid?, pending?, reset? }`) instead of Angular's
//   `AbstractControl` / signal-forms `Field` (any form library fits: `@rivetjs/forms`, a hand-made `computed`).
// - `STEPPER_GLOBAL_OPTIONS` (`showError`, `displayDefaultIndicatorType`) → Stepper options (`showError`,
//   `displayDefaultIndicatorType`), the injection token has no counterpart (pass them per stepper / via a wrapper).
// - `selectedIndexChange` → `onSelectedIndexChange` (+ two-way Signal `selectedIndex`), `selectionChange` →
//   `onSelectionChange` (`StepperSelectionEvent` with the step states instead of step instances), step
//   `interacted` output → `onInteracted`.
// - `_keyManager` → `focusIndex` signal (the header that takes Tab; `null` = the selected one) + `stepperHeaderKeyDown`
//   over the header elements in DOM order (`keys` `nextIndex`; no instance survives on a resumed page).
// - out-of-bounds `selectedIndex` assignments throw as upstream's dev mode (always: there is no prod switch here).
// Deviations: a step's `completed` / `hasError` / `editable` given as an accessor is read live and never overridden by
//   `reset()` (upstream writes the override; Rivet cannot write a caller's accessor) — pass a Signal or a value to let
//   `reset()` clear it.
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { controllable, controlledValue, setControlledValue, type ControlledState } from "../interactions/controllable.ts";
import { nextIndex } from "../keys/index.ts";
import type { Direction } from "../bidi/index.ts";

/** Position state of the content of each step (upstream `StepContentPositionState`), used for transitions. */
export type StepContentPositionState = "previous" | "current" | "next";

/** Possible orientation of a stepper (upstream `StepperOrientation`). */
export type StepperOrientation = "horizontal" | "vertical";

/**
 * ARIA pattern of the stepper (Rivet). `"tabs"` (default, Angular Material's accessible stepper): the header strip is a
 * `tablist`, headers are `tab`s with roving tabindex + arrow keys (horizontal) or `button`s with `aria-expanded` /
 * `aria-current="step"` (vertical), panels `tabpanel` / `region`. `"list"`: an ordered list (`ol` / `li`) with
 * `aria-current="step"`; interactive headers are native buttons in the Tab order (progress indicators without panels).
 */
export type StepperSemantics = "tabs" | "list";

/** A plain value or an accessor (read live). */
export type MaybeAccessor<T> = T | (() => T);

/**
 * Validation hook of a step (upstream `StepControl`: an `AbstractControl` / signal-forms `Field`). Values may be
 * accessors (read live) or booleans; `invalid` defaults to `!valid`, `pending` to `false`.
 */
export interface StepControl {
  valid: MaybeAccessor<boolean>;
  invalid?: MaybeAccessor<boolean>;
  pending?: MaybeAccessor<boolean>;
  /** Called by `stepperReset` / `stepReset` (clear the form). */
  reset?: () => void;
}

/** The state of each step (upstream `StepState`). */
export type StepState = "number" | "edit" | "done" | "error" | (string & {});

/** The different states of the steps (upstream `STEP_STATE`). */
export const STEP_STATE = {
  NUMBER: "number",
  EDIT: "edit",
  DONE: "done",
  ERROR: "error",
} as const;

/** Change event emitted on selection changes (upstream `StepperSelectionEvent`). */
export interface StepperSelectionEvent {
  /** Index of the step now selected. */
  selectedIndex: number;
  /** Index of the step previously selected. */
  previouslySelectedIndex: number;
  /** The step now selected. */
  selectedStep: StepItemState | undefined;
  /** The step previously selected. */
  previouslySelectedStep: StepItemState | undefined;
}

/** Stepper options (upstream `CdkStepper` inputs + `StepperOptions`). */
export interface StepperStateProps {
  /** The index of the selected step: a value (controlled), a two-way Signal, or an accessor. */
  selectedIndex?: number | Signal<number> | (() => number);
  /** Initial selected index (uncontrolled). @default 0 */
  defaultSelectedIndex?: number;
  /** Called with the new index when the selection changes (upstream `selectedIndexChange`). */
  onSelectedIndexChange?: (index: number) => void;
  /** Called when the selected step changes (upstream `selectionChange`). */
  onSelectionChange?: (event: StepperSelectionEvent) => void;
  /** Whether the validity of previous steps should be checked (upstream `linear`; read at event time). @default false */
  linear?: MaybeAccessor<boolean>;
  /** Orientation of the stepper (upstream `orientation`; read live). @default "horizontal" */
  orientation?: MaybeAccessor<StepperOrientation>;
  /** Whether the stepper shows an error state (upstream `StepperOptions.showError`). */
  showError?: boolean;
  /** Whether the default indicator type is used (upstream `StepperOptions.displayDefaultIndicatorType`). @default true */
  displayDefaultIndicatorType?: boolean;
  /** Rivet: ARIA pattern (read once). @default "tabs" */
  semantics?: StepperSemantics;
  /** Rivet, list semantics: headers are display only (plain elements, no handlers). @default false */
  isReadOnly?: boolean;
}

/** Stepper state (serializable). */
export interface StepperState {
  /** Id prefix of the header / content ids (upstream `_groupId`). */
  readonly id: string;
  /** Selected index (`controllable`). */
  readonly selected: ControlledState<number>;
  /** Registered steps of this stepper, in order. */
  readonly steps: Signal<StepItemState[]>;
  /** Index of the header that takes Tab (upstream key manager `activeItemIndex`); `null` = the selected step's. */
  readonly focusIndex: Signal<number | null>;
  readonly linear: MaybeAccessor<boolean>;
  readonly orientation: MaybeAccessor<StepperOrientation>;
  readonly showError: boolean | undefined;
  readonly displayDefaultIndicatorType: boolean;
  readonly semantics: StepperSemantics;
  /** List semantics: display-only headers (`isReadOnly`). */
  readonly readOnly: boolean;
  readonly onSelectionChange: ((event: StepperSelectionEvent) => void) | undefined;
}

/** Step options (upstream `CdkStep` inputs). */
export interface StepStateProps {
  /** Validation hook (upstream `stepControl`); takes precedence over `completed` for completion. */
  stepControl?: StepControl;
  /** Plain text label of the step. */
  label?: string;
  /** Error message shown when the step has an error. */
  errorMessage?: string;
  /** Custom state of the step (upstream `state`: the indicator type when completed / not editable). */
  state?: MaybeAccessor<StepState | undefined>;
  /** Whether the user can return to this step once it has been marked as completed. @default true */
  editable?: boolean | Signal<boolean> | (() => boolean);
  /** Whether the completion of the step is optional. @default false */
  optional?: MaybeAccessor<boolean>;
  /** Overrides the completed state (upstream `completed`): a value, a two-way Signal or an accessor. */
  completed?: boolean | Signal<boolean> | (() => boolean);
  /** Overrides the error state (upstream `hasError`): a value, a two-way Signal or an accessor. */
  hasError?: boolean | Signal<boolean> | (() => boolean);
  /** Called the first time the user attempts to move away from the step (upstream `interacted` output). */
  onInteracted?: () => void;
}

/** One step's state (serializable). */
export interface StepItemState {
  readonly interacted: Signal<boolean>;
  /** Upstream `_completedOverride` (`null`: derived). An accessor `completed` is read here, never written. */
  readonly completedOverride: Signal<boolean | null> | (() => boolean | null);
  /** Upstream `_customError` (`null`: derived from `stepControl`). */
  readonly customError: Signal<boolean | null> | (() => boolean | null);
  /** Upstream `_editable`. */
  readonly editable: Signal<boolean> | (() => boolean);
  readonly optional: MaybeAccessor<boolean>;
  readonly state: MaybeAccessor<StepState | undefined>;
  readonly stepControl: StepControl | undefined;
  readonly label: string | undefined;
  readonly errorMessage: string | undefined;
  readonly onInteracted: (() => void) | undefined;
}

const isSignal = <T>(v: unknown): v is Signal<T> => typeof v === "function" && typeof (v as Signal<T>).set === "function";
const read = <T>(v: MaybeAccessor<T>): T => (typeof v === "function" ? (v as () => T)() : v);
/** A signal for a plain value, the caller's Signal / accessor as is (`completed`, `hasError`, `editable`). */
const own = <T>(value: T | Signal<T> | (() => T) | undefined, fallback: T): Signal<T> | (() => T) =>
  value === undefined ? signal(fallback) : typeof value === "function" ? (value as Signal<T>) : signal(value as T);
const write = <T>(target: Signal<T> | (() => T), value: T): void => {
  if (isSignal<T>(target)) target.set(value);
};

/** Creates the stepper state. */
export function createStepperState(id: string, props: StepperStateProps = {}): StepperState {
  return {
    id,
    selected: controllable<number>(props.selectedIndex, props.defaultSelectedIndex ?? 0, props.onSelectedIndexChange),
    steps: signal<StepItemState[]>([]),
    focusIndex: signal<number | null>(null),
    linear: props.linear ?? false,
    orientation: props.orientation ?? "horizontal",
    showError: props.showError,
    displayDefaultIndicatorType: props.displayDefaultIndicatorType !== false,
    semantics: props.semantics ?? "tabs",
    readOnly: (props.semantics ?? "tabs") === "list" && !!props.isReadOnly,
    onSelectionChange: props.onSelectionChange,
  };
}

/** Creates one step's state. Register it with `registerStep`. */
export function createStepState(props: StepStateProps = {}): StepItemState {
  return {
    interacted: signal(false),
    completedOverride: own<boolean | null>(props.completed, null),
    customError: own<boolean | null>(props.hasError, null),
    editable: own<boolean>(props.editable, true),
    optional: props.optional ?? false,
    state: props.state,
    stepControl: props.stepControl,
    label: props.label,
    errorMessage: props.errorMessage,
    onInteracted: props.onInteracted,
  };
}

/** Adds `step` to the stepper (once; creation order). */
export function registerStep(state: StepperState, step: StepItemState): void {
  const steps = untrack(state.steps);
  if (!steps.includes(step)) state.steps.set([...steps, step]);
}

/**
 * Removes `step`; a selection past the end moves back one step (upstream `steps.changes` handler). The check runs in a
 * microtask, as upstream's `QueryList.changes` fires once the change settled: a step whose unit is disposed and created
 * again in the same task (a resumed page's adopt run retrying its probe, REDS-UI 2026-10-28: a display-only
 * `defaultStep={1}` stepper fell back to step 0 on the first interaction) re-registers before it, so nothing moves.
 */
export function unregisterStep(state: StepperState, step: StepItemState): void {
  state.steps.set(untrack(state.steps).filter((s) => s !== step));
  queueMicrotask(() => {
    const count = untrack(state.steps).length,
      selected = untrack(() => controlledValue(state.selected));
    if (selected >= count && selected > 0) {
      if (!state.selected.isControlled || state.selected.isSignal) state.selected.value.set(Math.max(selected - 1, 0));
    }
  });
}

// -------------------------------------------------------------------------------------------------
// Reads (bindings)
// -------------------------------------------------------------------------------------------------

/** The selected index (reads the signal). */
export const stepperSelectedIndex = (state: StepperState): number => state.selected.value();

/** Number of registered steps (reads the signal). */
export const stepCount = (state: StepperState): number => state.steps().length;

/** Index of `step` (-1 before registration; reads the signal). */
export const stepIndex = (state: StepperState, step: StepItemState): number => state.steps().indexOf(step);

/** The orientation (live). */
export const stepperOrientation = (state: StepperState): StepperOrientation => read(state.orientation);

/** Whether `step` is the selected one (upstream `isSelected`). */
export const stepIsSelected = (state: StepperState, step: StepItemState): boolean => stepIndex(state, step) === stepperSelectedIndex(state);

/** Whether `step` is the last registered step. */
export const stepIsLast = (state: StepperState, step: StepItemState): boolean => {
  const steps = state.steps();
  return steps.length > 0 && steps[steps.length - 1] === step;
};

function controlValid(control: StepControl): boolean {
  return !!read(control.valid);
}
function controlInvalid(control: StepControl): boolean {
  return control.invalid !== undefined ? !!read(control.invalid) : !read(control.valid);
}
function controlPending(control: StepControl): boolean {
  return control.pending !== undefined ? !!read(control.pending) : false;
}

/** Upstream `completed` getter: the override, else interacted and valid. */
export function stepCompleted(step: StepItemState): boolean {
  const override = step.completedOverride();
  const interacted = step.interacted();
  if (override != null) return override;
  return interacted && (!step.stepControl || controlValid(step.stepControl));
}

/** Upstream `hasError` getter: the custom error, else interacted and the control invalid. */
export function stepHasError(step: StepItemState): boolean {
  const custom = step.customError();
  return custom == null ? step.interacted() && !!step.stepControl && controlInvalid(step.stepControl) : custom;
}

/** Upstream `_showError`: the stepper's `showError`, else whether `hasError` was set explicitly. */
export function stepShowError(state: StepperState, step: StepItemState): boolean {
  return state.showError ?? step.customError() != null;
}

/** Whether the step is editable. */
export const stepEditable = (step: StepItemState): boolean => step.editable();

/** Whether the step is optional. */
export const stepOptional = (step: StepItemState): boolean => !!read(step.optional);

/** Type of indicator shown for the step (upstream `indicatorType`). */
export function stepIndicatorType(state: StepperState, step: StepItemState): StepState {
  const selected = stepIsSelected(state, step);
  const completed = stepCompleted(step);
  const defaultState = read(step.state) ?? STEP_STATE.NUMBER;
  const editable = step.editable();
  if (stepShowError(state, step) && stepHasError(step) && !selected) return STEP_STATE.ERROR;
  if (state.displayDefaultIndicatorType) {
    if (!completed || selected) return STEP_STATE.NUMBER;
    return editable ? STEP_STATE.EDIT : STEP_STATE.DONE;
  }
  if (completed && !selected) return STEP_STATE.DONE;
  if (completed && selected) return defaultState;
  return editable && selected ? STEP_STATE.EDIT : defaultState;
}

/** Whether the user can navigate to the step (upstream `isNavigable`). */
export function stepIsNavigable(state: StepperState, step: StepItemState): boolean {
  return stepCompleted(step) || stepIsSelected(state, step) || !read(state.linear);
}

/** Position of a step's content relative to the selected one (upstream `_getAnimationDirection`). */
export function stepContentPosition(state: StepperState, index: number, direction: Direction = "ltr"): StepContentPositionState {
  const position = index - stepperSelectedIndex(state);
  if (position < 0) return direction === "rtl" ? "next" : "previous";
  if (position > 0) return direction === "rtl" ? "previous" : "next";
  return "current";
}

/** Index of the header that takes Tab (upstream `_getFocusIndex`). */
export const stepperFocusIndex = (state: StepperState): number => state.focusIndex() ?? stepperSelectedIndex(state);

/** Id of a step's header (upstream `_getStepLabelId`). */
export const stepLabelId = (state: StepperState, index: number): string => `${state.id}-label-${index}`;

/** Id of a step's content (upstream `_getStepContentId`). */
export const stepContentId = (state: StepperState, index: number): string => `${state.id}-content-${index}`;

// -------------------------------------------------------------------------------------------------
// Actions (handlers)
// -------------------------------------------------------------------------------------------------

/** Upstream `_markAsInteracted`. */
export function markStepInteracted(step: StepItemState): void {
  if (!untrack(step.interacted)) {
    step.interacted.set(true);
    step.onInteracted?.();
  }
}

function anyControlsInvalidOrPending(state: StepperState, index: number): boolean {
  if (!untrack(() => read(state.linear)) || index < 0) return false;
  return untrack(() =>
    state
      .steps()
      .slice(0, index)
      .some((step) => {
        const control = step.stepControl;
        const isIncomplete = control ? controlInvalid(control) || controlPending(control) || !step.interacted() : !stepCompleted(step);
        return isIncomplete && !read(step.optional) && !step.completedOverride();
      }),
  );
}

/** Whether `index` is a valid step index (upstream `_isValidIndex`). */
export function isValidStepIndex(state: StepperState, index: number): boolean {
  const count = untrack(state.steps).length;
  return index > -1 && (count === 0 || index < count);
}

/**
 * Upstream `selectedIndex` setter: marks the current step interacted, then selects `index` unless a previous step of a
 * linear stepper is invalid / pending / not completed, or `index` is before the current step and not editable.
 * Throws for an out-of-bounds index once steps are registered.
 */
export function selectStep(state: StepperState, index: number): void {
  const steps = untrack(state.steps);
  if (!steps.length) {
    // Upstream: before the steps exist the index is stored as is.
    if (!state.selected.isControlled || state.selected.isSignal) state.selected.value.set(index);
    else state.selected.onChange?.(index);
    return;
  }
  if (!isValidStepIndex(state, index)) throw new Error("cdkStepper: Cannot assign out-of-bounds value to `selectedIndex`.");
  const current = controlledValue(state.selected);
  if (current === index) return;
  const currentStep = steps[current];
  if (currentStep) markStepInteracted(currentStep);
  if (!anyControlsInvalidOrPending(state, index) && (index >= current || untrack(steps[index]!.editable))) updateSelectedIndex(state, index);
}

function updateSelectedIndex(state: StepperState, index: number): void {
  const steps = untrack(state.steps);
  const previous = controlledValue(state.selected);
  state.onSelectionChange?.({
    selectedIndex: index,
    previouslySelectedIndex: previous,
    selectedStep: steps[index],
    previouslySelectedStep: steps[previous],
  });
  // Upstream: focus inside the stepper moves to the new header (else the key manager only updates its active item).
  const header = focusedStepperHeaders(state);
  state.focusIndex.set(null);
  setControlledValue(state.selected, index);
  if (header) header[index]?.focus();
}

/** Upstream `next()`: selects the next step (the last one stays). */
export function stepperNext(state: StepperState): void {
  selectStep(state, Math.min(controlledValue(state.selected) + 1, untrack(state.steps).length - 1));
}

/** Upstream `previous()`: selects the previous step. */
export function stepperPrevious(state: StepperState): void {
  selectStep(state, Math.max(controlledValue(state.selected) - 1, 0));
}

/** Upstream `CdkStep.reset()`: interacted, completed / error overrides and the step control. */
export function stepReset(step: StepItemState): void {
  step.interacted.set(false);
  if (untrack(step.completedOverride) != null) write(step.completedOverride, false);
  if (untrack(step.customError) != null) write(step.customError, false);
  step.stepControl?.reset?.();
}

/** Upstream `reset()`: back to the first step (no validation) and every step reset. */
export function stepperReset(state: StepperState): void {
  if (controlledValue(state.selected) !== 0) updateSelectedIndex(state, 0);
  for (const step of untrack(state.steps)) stepReset(step);
}

/**
 * Upstream `ngAfterViewInit`: a linear stepper starting past step 0 marks the visited steps interacted (so they can be
 * navigated back to). Call once the steps are registered.
 */
export function markVisitedSteps(state: StepperState): void {
  const selected = controlledValue(state.selected);
  if (!untrack(() => read(state.linear)) || selected <= 0) return;
  for (const step of untrack(state.steps).slice(0, selected)) markStepInteracted(step);
}

// -------------------------------------------------------------------------------------------------
// Keyboard (upstream `_onKeydown` + FocusKeyManager)
// -------------------------------------------------------------------------------------------------

/** Header elements of the stepper in DOM order (tabs semantics: `[data-rv-step-header="<id>"]`). */
export function stepperHeaders(root: ParentNode, state: StepperState): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(`[data-rv-step-header="${state.id}"]`)];
}

function focusedStepperHeaders(state: StepperState): HTMLElement[] | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  const root = active?.closest?.(`[data-rv-stepper="${state.id}"]`);
  return root ? stepperHeaders(root, state) : null;
}

/** Keys the header key manager handles (a `data-rk` value: held while the handler chunk loads). */
export function stepperKeys(orientation: StepperOrientation): string {
  return orientation === "vertical" ? "ArrowDown ArrowUp ArrowLeft ArrowRight Home End Enter Space" : "ArrowLeft ArrowRight Home End Enter Space";
}

/**
 * `keydown` on a step header (tabs semantics): Enter / Space (no modifier) select the focused header's step; arrows
 * move focus (horizontal: Left / Right; vertical: all four), wrapping, Home / End; RTL reverses Left / Right.
 */
export function stepperHeaderKeyDown(state: StepperState, event: KeyboardEvent, direction: Direction = "ltr"): void {
  const header = event.currentTarget as HTMLElement;
  const root = header.closest(`[data-rv-stepper="${state.id}"]`);
  if (!root) return;
  const headers = stepperHeaders(root, state);
  const active = headers.indexOf(header);
  const hasModifier = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
  if (active < 0 || hasModifier) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    selectStep(state, active);
    return;
  }
  const vertical = read(state.orientation) === "vertical";
  const next = nextIndex(headers.length, active, event.key, { orientation: vertical ? "both" : "horizontal", wrap: true, homeEnd: true, dir: direction });
  if (next == null) return;
  event.preventDefault();
  state.focusIndex.set(next);
  headers[next]?.focus();
}
