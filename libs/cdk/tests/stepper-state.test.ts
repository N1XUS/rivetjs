// `@rivetjs/cdk/stepper/state` (port of Angular CDK `CdkStepper` / `CdkStep` logic, MIT, © Google LLC) without a DOM:
// the state machine (linear checks, editable, optional, completed / error overrides, indicator types, reset) and its
// serializability (resume-table JSON round trip: plain data + signals only).
import { describe, expect, it } from "vitest";
import { signal } from "@rivetjs/reactivity";
import {
  STEP_STATE,
  createStepState,
  createStepperState,
  registerStep,
  selectStep,
  stepCompleted,
  stepContentPosition,
  stepHasError,
  stepIndicatorType,
  stepIsNavigable,
  stepperNext,
  stepperPrevious,
  stepperReset,
  stepperSelectedIndex,
  unregisterStep,
  type StepStateProps,
} from "../stepper/state.ts";
import { jsonRoundTrip } from "./state-json.ts";

function setup(props: Parameters<typeof createStepperState>[1] = {}, steps: StepStateProps[] = [{}, {}, {}]) {
  const state = createStepperState("s", props);
  const items = steps.map((p) => createStepState(p));
  for (const step of items) registerStep(state, step);
  return { state, items };
}

describe("stepper state", () => {
  it("stores the index before steps exist and clamps next / previous", () => {
    const state = createStepperState("s", {});
    selectStep(state, 2);
    expect(stepperSelectedIndex(state)).toBe(2);
    const { state: s } = setup();
    stepperNext(s);
    stepperNext(s);
    stepperNext(s);
    expect(stepperSelectedIndex(s)).toBe(2);
    stepperPrevious(s);
    stepperPrevious(s);
    stepperPrevious(s);
    expect(stepperSelectedIndex(s)).toBe(0);
  });

  it("registers a step once and re-indexes on removal", () => {
    const { state, items } = setup();
    registerStep(state, items[0]!);
    expect(state.steps()).toHaveLength(3);
    selectStep(state, 2);
    unregisterStep(state, items[2]!);
    expect(stepperSelectedIndex(state)).toBe(1);
  });

  it("marks the step interacted when moving away; completed = interacted + valid", () => {
    const valid = signal(false);
    const { state, items } = setup({}, [{ stepControl: { valid } }, {}]);
    expect(stepCompleted(items[0]!)).toBe(false);
    selectStep(state, 1);
    expect(items[0]!.interacted()).toBe(true);
    expect(stepCompleted(items[0]!)).toBe(false);
    expect(stepHasError(items[0]!)).toBe(true);
    valid.set(true);
    expect(stepCompleted(items[0]!)).toBe(true);
    expect(stepHasError(items[0]!)).toBe(false);
  });

  it("linear: blocks on invalid / pending, allows optional and completed overrides", () => {
    const valid = signal(false);
    const pending = signal(false);
    const { state, items } = setup({ linear: true }, [{ stepControl: { valid, pending } }, { optional: true }, {}]);
    expect(stepIsNavigable(state, items[1]!)).toBe(false);
    selectStep(state, 1);
    expect(stepperSelectedIndex(state)).toBe(0);
    valid.set(true);
    pending.set(true);
    selectStep(state, 1);
    expect(stepperSelectedIndex(state)).toBe(0);
    pending.set(false);
    selectStep(state, 2);
    expect(stepperSelectedIndex(state)).toBe(2);
  });

  it("indicator types: number / edit / done / error / custom state", () => {
    const { state, items } = setup({ showError: true }, [{ completed: true }, { completed: true, editable: false }, { hasError: true }, { state: "phone" }]);
    selectStep(state, 3);
    expect(stepIndicatorType(state, items[0]!)).toBe(STEP_STATE.EDIT);
    expect(stepIndicatorType(state, items[1]!)).toBe(STEP_STATE.DONE);
    expect(stepIndicatorType(state, items[2]!)).toBe(STEP_STATE.ERROR);
    expect(stepIndicatorType(state, items[3]!)).toBe(STEP_STATE.NUMBER);
    const custom = setup({ displayDefaultIndicatorType: false }, [{ state: "phone" }, {}]);
    expect(stepIndicatorType(custom.state, custom.items[0]!)).toBe(STEP_STATE.EDIT);
    expect(stepIndicatorType(custom.state, custom.items[1]!)).toBe("number");
  });

  it("reset: back to 0 without validation, overrides cleared, controls reset", () => {
    let resets = 0;
    const completed = signal<boolean>(true);
    const { state, items } = setup({ linear: true }, [{ completed, stepControl: { valid: true, reset: () => resets++ } }, {}, {}]);
    selectStep(state, 1);
    expect(stepperSelectedIndex(state)).toBe(1);
    stepperReset(state);
    expect(stepperSelectedIndex(state)).toBe(0);
    expect(items[0]!.interacted()).toBe(false);
    expect(completed()).toBe(false);
    expect(resets).toBe(1);
  });

  it("content position follows the selection and RTL", () => {
    const { state } = setup({ defaultSelectedIndex: 1 });
    expect([0, 1, 2].map((i) => stepContentPosition(state, i))).toEqual(["previous", "current", "next"]);
    expect([0, 1, 2].map((i) => stepContentPosition(state, i, "rtl"))).toEqual(["next", "current", "previous"]);
  });

  it("is serializable (resume-table round trip)", () => {
    const { state } = setup({ linear: true, defaultSelectedIndex: 1 }, [{ label: "A", completed: true }, { label: "B", optional: true }, {}]);
    const decoded = jsonRoundTrip(state);
    expect(decoded.id).toBe("s");
    expect(decoded.selected.value()).toBe(1);
    expect(decoded.steps()).toHaveLength(3);
    expect(decoded.steps()[0]!.label).toBe("A");
    expect(stepCompleted(decoded.steps()[0]!)).toBe(true);
  });
});
