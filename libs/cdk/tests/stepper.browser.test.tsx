// Port of Angular Material's stepper spec (src/material/stepper/stepper.spec.ts, v22.2.2, MIT, © Google LLC) onto
// `@rivetjs/cdk/stepper` (port of Angular CDK `CdkStepper`). Changes: TestBed fixtures → Rivet components rendered with
// `@rivetjs/runtime/testing`; reactive forms → `StepControl` objects over signals; `fixture.detectChanges()` → `flush()`;
// Material-only cases (ripples, theming, icon overrides, intl labels, animations, header prefix, label position) are
// not ported. Rivet cases: list semantics, read-only headers, `useStepper` / `useStep`, render props, `StepPanel`.
import { afterEach, describe, expect, it } from "vitest";
import "@rivetjs/testing/jest-dom";
import { signal, type Signal } from "@rivetjs/reactivity";
import { cleanup, flush, render } from "@rivetjs/runtime/testing";
import { I18nProvider } from "../i18n/i18n-provider.tsx";
import {
  Step,
  StepHeader,
  StepLabel,
  StepList,
  StepPanel,
  Stepper,
  StepperNext,
  StepperPrevious,
  useStep,
  useStepper,
  type StepControl,
  type StepperApi,
  type StepperProps,
  type StepperSelectionEvent,
  type StepProps,
} from "../stepper/index.tsx";

afterEach(async () => {
  cleanup();
  await flush();
});

const headers = () => [...document.querySelectorAll<HTMLElement>("[data-rv-step-header]")];
const panels = () => [...document.querySelectorAll<HTMLElement>(".rv-StepPanel")];
const nextButtons = () => [...document.querySelectorAll<HTMLButtonElement>(".next")];
const prevButtons = () => [...document.querySelectorAll<HTMLButtonElement>(".prev")];
const key = (el: Element, k: string, init: KeyboardEventInit = {}) => {
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }));
};
const click = (el: HTMLElement) => el.click();
const settle = () => flush();

/** Simple horizontal / vertical stepper (upstream `SimpleMatHorizontalStepperApp` / `SimpleMatVerticalStepperApp`). */
function Simple(props: { stepper?: StepperProps; steps?: StepProps[]; api?: (api: StepperApi) => void; count?: Signal<number> }) {
  const Probe = () => {
    props.api?.(useStepper());
    return null;
  };
  const labels = ["Step 1", "Step 2", "Step 3"];
  return (
    <Stepper id="st" {...(props.stepper ?? {})}>
      <Probe />
      <StepList aria-label="Steps">
        {labels.map((label, i) => (
          <Step label={label} {...(props.steps?.[i] ?? {})}>
            <StepHeader />
          </Step>
        ))}
      </StepList>
      {labels.map((label, i) => (
        <StepPanel index={i}>
          Content {i + 1}
          <StepperPrevious class="prev">Back</StepperPrevious>
          <StepperNext class="next">Next</StepperNext>
        </StepPanel>
      ))}
    </Stepper>
  );
}

const control = (valid: Signal<boolean>, pending?: Signal<boolean>, onReset?: () => void): StepControl => ({
  valid: () => valid(),
  pending: pending ? () => pending() : undefined,
  reset: () => {
    valid.set(false);
    onReset?.();
  },
});

describe("basic stepper", () => {
  it("should default to the first step", async () => {
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} />);
    await settle();
    expect(api.selectedIndex()).toBe(0);
    expect(headers()[0]).toHaveAttribute("aria-selected", "true");
  });

  it("should throw when a negative / out-of-bounds index is selected", async () => {
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} />);
    await settle();
    expect(() => api.select(-1)).toThrow("cdkStepper: Cannot assign out-of-bounds value to `selectedIndex`.");
    expect(() => api.select(99)).toThrow("cdkStepper: Cannot assign out-of-bounds value to `selectedIndex`.");
  });

  it("should change selected index on header click", async () => {
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} />);
    await settle();
    click(headers()[1]!);
    await settle();
    expect(api.selectedIndex()).toBe(1);
    expect(headers()[1]).toHaveAttribute("aria-selected", "true");
    expect(headers()[0]).toHaveAttribute("aria-selected", "false");
    click(headers()[2]!);
    await settle();
    expect(api.selectedIndex()).toBe(2);
  });

  it("should display the correct label", async () => {
    render(() => <Simple />);
    await settle();
    expect(headers()[0]).toHaveTextContent("Step 1");
    click(headers()[2]!);
    await settle();
    expect(headers()[2]).toHaveTextContent("Step 3");
  });

  it("should go to next / previous available step when the buttons are clicked", async () => {
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} />);
    await settle();
    click(nextButtons()[0]!);
    await settle();
    expect(api.selectedIndex()).toBe(1);
    click(nextButtons()[1]!);
    await settle();
    expect(api.selectedIndex()).toBe(2);
    click(nextButtons()[2]!);
    await settle();
    expect(api.selectedIndex()).toBe(2);
    click(prevButtons()[2]!);
    await settle();
    expect(api.selectedIndex()).toBe(1);
    click(prevButtons()[1]!);
    click(prevButtons()[0]!);
    await settle();
    expect(api.selectedIndex()).toBe(0);
  });

  it('should set the next button type to "submit" and the previous one to "button"', async () => {
    render(() => <Simple />);
    await settle();
    expect(nextButtons()[0]).toHaveAttribute("type", "submit");
    expect(prevButtons()[0]).toHaveAttribute("type", "button");
  });

  it("should set the correct step position for animation", async () => {
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} />);
    await settle();
    expect(panels().map((p) => p.dataset.position)).toEqual(["current", "next", "next"]);
    api.select(2);
    await settle();
    expect(panels().map((p) => p.dataset.position)).toEqual(["previous", "previous", "current"]);
  });

  it("should reverse the step position in RTL", async () => {
    let api!: StepperApi;
    render(() => (
      <I18nProvider locale="ar-EG">
        <Simple api={(a) => (api = a)} />
      </I18nProvider>
    ));
    await settle();
    expect(panels().map((p) => p.dataset.position)).toEqual(["current", "previous", "previous"]);
    api.select(2);
    await settle();
    expect(panels().map((p) => p.dataset.position)).toEqual(["next", "next", "current"]);
  });

  it("should not set focus on header of selected step if header is not clicked", async () => {
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} />);
    await settle();
    api.select(1);
    await settle();
    expect(document.activeElement).not.toBe(headers()[1]);
  });

  it("should focus next step header if focus is inside the stepper", async () => {
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} />);
    await settle();
    headers()[0]!.focus();
    api.select(1);
    await settle();
    expect(document.activeElement).toBe(headers()[1]);
  });

  it("should only be able to return to a previous step if it is editable", async () => {
    const editable = signal(false);
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} steps={[{ editable }]} />);
    await settle();
    api.select(1);
    await settle();
    expect(api.selectedIndex()).toBe(1);
    api.select(0);
    await settle();
    expect(api.selectedIndex()).toBe(1);
    editable.set(true);
    api.select(0);
    await settle();
    expect(api.selectedIndex()).toBe(0);
  });

  it("should set the edit state if step is editable and completed, done if not editable", async () => {
    const completed = signal(true);
    const editable = signal(true);
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} steps={[{ completed, editable }]} />);
    await settle();
    api.select(1);
    await settle();
    expect(headers()[0]).toHaveAttribute("data-state", "edit");
    editable.set(false);
    await settle();
    expect(headers()[0]).toHaveAttribute("data-state", "done");
  });

  it("should adjust the index when removing a step before the current one", async () => {
    const show = signal(true);
    let api!: StepperApi;
    const App = () => {
      const Probe = () => {
        api = useStepper();
        return null;
      };
      return (
        <Stepper>
          <Probe />
          <StepList>
            <Step label="A">
              <StepHeader />
            </Step>
            <Step label="B">
              <StepHeader />
            </Step>
            {() =>
              show() ? (
                <Step label="C">
                  <StepHeader />
                </Step>
              ) : null
            }
          </StepList>
        </Stepper>
      );
    };
    render(() => <App />);
    await settle();
    api.select(2);
    await settle();
    expect(api.selectedIndex()).toBe(2);
    show.set(false);
    await settle();
    expect(api.stepCount()).toBe(2);
    expect(api.selectedIndex()).toBe(1);
  });

  it("should not do anything when pressing ENTER / SPACE with a modifier", async () => {
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} />);
    await settle();
    const h = headers();
    h[0]!.focus();
    key(h[0]!, "ArrowRight");
    await settle();
    expect(document.activeElement).toBe(h[1]);
    for (const k of ["Enter", " "]) {
      for (const mod of ["altKey", "shiftKey", "ctrlKey", "metaKey"] as const) {
        key(h[1]!, k, { [mod]: true });
        await settle();
        expect(api.selectedIndex()).toBe(0);
      }
    }
    key(h[1]!, "Enter");
    await settle();
    expect(api.selectedIndex()).toBe(1);
    key(h[0]!, "ArrowRight");
    h[2]!.focus();
    key(h[2]!, " ");
    await settle();
    expect(api.selectedIndex()).toBe(2);
  });

  it("should emit selection change events", async () => {
    const events: StepperSelectionEvent[] = [];
    const indices: number[] = [];
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} stepper={{ onSelectionChange: (e) => events.push(e), onSelectedIndexChange: (i) => indices.push(i) }} />);
    await settle();
    api.select(2);
    await settle();
    expect(events).toHaveLength(1);
    expect(events[0]!.selectedIndex).toBe(2);
    expect(events[0]!.previouslySelectedIndex).toBe(0);
    expect(events[0]!.selectedStep?.label).toBe("Step 3");
    expect(events[0]!.previouslySelectedStep?.label).toBe("Step 1");
    expect(indices).toEqual([2]);
  });
});

describe("linear stepper", () => {
  function Linear(props: {
    api?: (api: StepperApi) => void;
    valid: Signal<boolean>[];
    pending?: Signal<boolean>;
    optional3?: boolean;
    completed1?: Signal<boolean>;
  }) {
    const Probe = () => {
      props.api?.(useStepper());
      return null;
    };
    const v = props.valid;
    return (
      <Stepper id="ln" linear orientation="vertical">
        <Probe />
        <Step label="One" stepControl={control(v[0]!)} completed={props.completed1}>
          <StepHeader />
          <StepPanel>
            <StepperNext class="next">Next</StepperNext>
          </StepPanel>
        </Step>
        <Step label="Two" stepControl={control(v[1]!, props.pending)}>
          <StepHeader />
          <StepPanel>
            <StepperPrevious class="prev">Back</StepperPrevious>
            <StepperNext class="next">Next</StepperNext>
          </StepPanel>
        </Step>
        <Step label="Three" stepControl={control(v[2]!)} optional={props.optional3}>
          <StepHeader />
          <StepPanel>
            <StepperNext class="next">Next</StepperNext>
          </StepPanel>
        </Step>
        <Step label="Done">
          <StepHeader />
          <StepPanel>Done</StepPanel>
        </Step>
      </Stepper>
    );
  }
  const valids = () => [signal(false), signal(false), signal(false)];

  it("should not move to next step if current step is invalid", async () => {
    const v = valids();
    let api!: StepperApi;
    render(() => <Linear valid={v} api={(a) => (api = a)} />);
    await settle();
    click(headers()[1]!);
    await settle();
    expect(api.selectedIndex()).toBe(0);
    click(nextButtons()[0]!);
    await settle();
    expect(api.selectedIndex()).toBe(0);
    v[0]!.set(true);
    click(headers()[1]!);
    await settle();
    expect(api.selectedIndex()).toBe(1);
  });

  it("should not move to next step if current step is pending", async () => {
    const v = valids();
    const pending = signal(true);
    let api!: StepperApi;
    render(() => <Linear valid={v} pending={pending} api={(a) => (api = a)} />);
    await settle();
    v[0]!.set(true);
    v[1]!.set(true);
    api.select(1);
    await settle();
    expect(api.selectedIndex()).toBe(1);
    click(headers()[2]!);
    click(nextButtons()[1]!);
    await settle();
    expect(api.selectedIndex()).toBe(1);
    pending.set(false);
    click(headers()[2]!);
    await settle();
    expect(api.selectedIndex()).toBe(2);
  });

  it("should give non-selectable headers tabindex -1 and aria-disabled", async () => {
    render(() => <Linear valid={valids()} />);
    await settle();
    expect(headers()[1]).toHaveAttribute("tabindex", "-1");
    expect(headers().map((h) => h.getAttribute("aria-disabled"))).toEqual([null, "true", "true", "true"]);
  });

  it("should be able to move to next step even when invalid if current step is optional", async () => {
    const v = valids();
    let api!: StepperApi;
    render(() => <Linear valid={v} optional3 api={(a) => (api = a)} />);
    await settle();
    v[0]!.set(true);
    v[1]!.set(true);
    api.select(1);
    api.select(2);
    await settle();
    expect(api.selectedIndex()).toBe(2);
    click(nextButtons()[2]!);
    await settle();
    expect(api.selectedIndex()).toBe(3);
  });

  it("should be able to reset the stepper to its initial state", async () => {
    const v = valids();
    let api!: StepperApi;
    let resets = 0;
    const steps: { interacted: () => boolean }[] = [];
    const App = () => {
      const Probe = () => {
        api = useStepper();
        return null;
      };
      return (
        <Stepper linear>
          <Probe />
          <Step label="One" stepControl={control(v[0]!, undefined, () => resets++)}>
            <StepHeader />
            <StepPanel>one</StepPanel>
          </Step>
          <Step label="Two" stepControl={control(v[1]!)}>
            <StepHeader />
            <StepPanel>two</StepPanel>
          </Step>
          <Step label="Three">
            <StepHeader />
            <StepPanel>three</StepPanel>
          </Step>
        </Stepper>
      );
    };
    render(() => <App />);
    await settle();
    v[0]!.set(true);
    api.next();
    api.next();
    await settle();
    const [one, two] = api.state.steps();
    steps.push(one!, two!);
    expect(api.selectedIndex()).toBe(1);
    expect(one!.interacted()).toBe(true);
    expect(two!.interacted()).toBe(true);
    api.reset();
    await settle();
    expect(api.selectedIndex()).toBe(0);
    expect(one!.interacted()).toBe(false);
    expect(two!.interacted()).toBe(false);
    expect(v[0]!()).toBe(false);
    expect(resets).toBe(1);
  });

  it("should reset back to the first step when some of the steps are not editable", async () => {
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} stepper={{ linear: true }} steps={[{ editable: false, completed: true }]} />);
    await settle();
    api.next();
    await settle();
    expect(api.selectedIndex()).toBe(1);
    api.reset();
    await settle();
    expect(api.selectedIndex()).toBe(0);
  });

  it("should be able to skip past the current step if a custom `completed` value is set", async () => {
    const v = valids();
    const completed = signal<boolean>(false);
    let api!: StepperApi;
    render(() => <Linear valid={v} completed1={completed} api={(a) => (api = a)} />);
    await settle();
    click(nextButtons()[0]!);
    await settle();
    expect(api.selectedIndex()).toBe(0);
    completed.set(true);
    click(nextButtons()[0]!);
    await settle();
    expect(api.selectedIndex()).toBe(1);
  });

  it("should not move to the next step if the current one is not completed (no stepControl)", async () => {
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} stepper={{ linear: true }} steps={[{ completed: false }]} />);
    await settle();
    click(headers()[1]!);
    await settle();
    expect(api.selectedIndex()).toBe(0);
  });

  it("should have the `stepControl` take precedence when `completed` is set", async () => {
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} stepper={{ linear: true }} steps={[{ completed: false, stepControl: { valid: true } }]} />);
    await settle();
    click(headers()[1]!);
    await settle();
    expect(api.selectedIndex()).toBe(1);
  });

  it("should navigate to previous steps of a stepper starting on the last step", async () => {
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} stepper={{ linear: true, defaultSelectedIndex: 2 }} />);
    await settle();
    expect(api.selectedIndex()).toBe(2);
    api.previous();
    await settle();
    expect(api.selectedIndex()).toBe(1);
    api.previous();
    await settle();
    expect(api.selectedIndex()).toBe(0);
  });

  it("must be visited if not optional, can be skipped if optional (valid step)", async () => {
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} stepper={{ linear: true }} steps={[{ stepControl: { valid: true } }, { stepControl: { valid: true } }]} />);
    await settle();
    api.select(1);
    await settle();
    expect(api.selectedIndex()).toBe(1);
    api.select(2);
    await settle();
    expect(api.selectedIndex()).toBe(2);
  });

  it("cannot skip a valid step that was never visited (not optional)", async () => {
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} stepper={{ linear: true }} steps={[{ stepControl: { valid: true } }, { stepControl: { valid: true } }]} />);
    await settle();
    api.select(2);
    await settle();
    expect(api.selectedIndex()).toBe(0);
  });

  it("can be skipped entirely if optional", async () => {
    let api!: StepperApi;
    render(() => (
      <Simple api={(a) => (api = a)} stepper={{ linear: true }} steps={[{ stepControl: { valid: true } }, { stepControl: { valid: true }, optional: true }]} />
    ));
    await settle();
    api.select(2);
    await settle();
    expect(api.selectedIndex()).toBe(2);
  });

  it("should emit when the user has interacted with a step, once", async () => {
    const interacted: string[] = [];
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} steps={[{ onInteracted: () => interacted.push("one") }, { onInteracted: () => interacted.push("two") }]} />);
    await settle();
    api.select(0);
    expect(interacted).toEqual([]);
    api.select(1);
    api.select(0);
    api.select(1);
    expect(interacted).toEqual(["one", "two"]);
  });
});

describe("keyboard", () => {
  const assertKeys = async (orientation: "horizontal" | "vertical", rtl = false) => {
    render(() =>
      rtl ? (
        <I18nProvider locale="he-IL">
          <Simple stepper={{ orientation }} />
        </I18nProvider>
      ) : (
        <Simple stepper={{ orientation }} />
      ),
    );
    await settle();
    const h = headers();
    h[0]!.focus();
    const fwd = rtl ? "ArrowLeft" : "ArrowRight";
    const back = rtl ? "ArrowRight" : "ArrowLeft";
    key(h[0]!, fwd);
    await settle();
    expect(document.activeElement).toBe(h[1]);
    expect(h[1]).toHaveAttribute("tabindex", "0");
    expect(h[0]).toHaveAttribute("tabindex", "-1");
    key(h[1]!, back);
    await settle();
    expect(document.activeElement).toBe(h[0]);
    key(h[0]!, back);
    await settle();
    expect(document.activeElement).toBe(h[2]);
    key(h[2]!, fwd);
    await settle();
    expect(document.activeElement).toBe(h[0]);
    key(h[0]!, "End");
    await settle();
    expect(document.activeElement).toBe(h[2]);
    key(h[2]!, "Home");
    await settle();
    expect(document.activeElement).toBe(h[0]);
    key(h[0]!, "ArrowDown");
    await settle();
    expect(document.activeElement).toBe(orientation === "vertical" ? h[1] : h[0]);
    if (orientation === "vertical") {
      key(h[1]!, "ArrowUp");
      await settle();
      expect(document.activeElement).toBe(h[0]);
    }
  };

  it("horizontal: left / right arrows move focus", () => assertKeys("horizontal"));
  it("horizontal: reverses arrow keys in RTL", () => assertKeys("horizontal", true));
  it("vertical: up / down and left / right arrows move focus", () => assertKeys("vertical"));
  it("vertical: reverses left / right in RTL", () => assertKeys("vertical", true));

  it("should maintain the navigation order when a step is added later on", async () => {
    const show = signal(false);
    const App = () => (
      <Stepper>
        <StepList>
          <Step label="A">
            <StepHeader />
          </Step>
          <Step label="B">
            <StepHeader />
          </Step>
          {() =>
            show() ? (
              <Step label="C">
                <StepHeader />
              </Step>
            ) : null
          }
        </StepList>
      </Stepper>
    );
    render(() => <App />);
    await settle();
    show.set(true);
    await settle();
    const h = headers();
    expect(h).toHaveLength(3);
    h[1]!.focus();
    key(h[1]!, "ArrowRight");
    await settle();
    expect(document.activeElement).toBe(h[2]);
  });
});

describe("aria", () => {
  it("horizontal: tablist with aria-orientation + aria-label, tabs with aria-controls", async () => {
    render(() => <Simple />);
    await settle();
    const list = document.querySelector('[role="tablist"]')!;
    expect(list).toHaveAttribute("aria-orientation", "horizontal");
    expect(list).toHaveAttribute("aria-label", "Steps");
    expect(headers().every((h) => h.getAttribute("role") === "tab")).toBe(true);
    expect(headers()[1]).toHaveAttribute("aria-controls", "st-content-1");
    expect(panels()[1]).toHaveAttribute("role", "tabpanel");
    expect(panels()[1]).toHaveAttribute("aria-labelledby", "st-label-1");
    expect(panels()[1]).toHaveAttribute("hidden");
    expect(panels()[0]).not.toHaveAttribute("hidden");
  });

  it("vertical: button headers with aria-expanded / aria-current, region panels", async () => {
    let api!: StepperApi;
    render(() => <Simple stepper={{ orientation: "vertical" }} api={(a) => (api = a)} />);
    await settle();
    expect(document.querySelector('[role="tablist"]')).toBeNull();
    expect(headers()[0]).toHaveAttribute("role", "button");
    expect(headers()[0]).toHaveAttribute("aria-expanded", "true");
    expect(headers()[0]).toHaveAttribute("aria-current", "step");
    api.select(1);
    await settle();
    expect(headers()[0]).toHaveAttribute("aria-expanded", "false");
    expect(headers()[0]).not.toHaveAttribute("aria-current");
    expect(panels()[0]).toHaveAttribute("role", "region");
  });

  it("orientation can switch at runtime", async () => {
    const orientation = signal<"horizontal" | "vertical">("horizontal");
    render(() => <Simple stepper={{ orientation: () => orientation() }} />);
    await settle();
    expect(headers()[0]).toHaveAttribute("role", "tab");
    orientation.set("vertical");
    await settle();
    expect(headers()[0]).toHaveAttribute("role", "button");
    expect(document.querySelector(".rv-Stepper")).toHaveAttribute("data-orientation", "vertical");
  });

  it("should set aria-label / aria-labelledby on headers, aria-label wins", async () => {
    render(() => <Simple steps={[{}, {}, {}]} />);
    await settle();
    expect(headers()[0]).not.toHaveAttribute("aria-label");
    expect(headers()[0]).not.toHaveAttribute("aria-labelledby");
    cleanup();
    render(() => (
      <Stepper>
        <StepList>
          <Step>
            <StepHeader aria-label="First" aria-labelledby="x" />
          </Step>
          <Step>
            <StepHeader aria-labelledby="y" />
          </Step>
        </StepList>
      </Stepper>
    ));
    await settle();
    expect(headers()[0]).toHaveAttribute("aria-label", "First");
    expect(headers()[0]).not.toHaveAttribute("aria-labelledby");
    expect(headers()[1]).toHaveAttribute("aria-labelledby", "y");
  });
});

describe("error state", () => {
  it("should show error state (showError)", async () => {
    const v = signal(false);
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} stepper={{ showError: true }} steps={[{ stepControl: control(v) }]} />);
    await settle();
    api.select(1);
    await settle();
    expect(headers()[0]).toHaveAttribute("data-state", "error");
    expect(headers()[0]).toHaveAttribute("data-invalid", "true");
  });

  it("should respect a custom falsy hasError value", async () => {
    const v = signal(false);
    const hasError = signal(false);
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} steps={[{ stepControl: control(v), hasError }]} />);
    await settle();
    api.select(1);
    await settle();
    expect(headers()[0]).not.toHaveAttribute("data-state", "error");
    hasError.set(true);
    await settle();
    expect(headers()[0]).toHaveAttribute("data-state", "error");
  });

  it("Material guideline logic (displayDefaultIndicatorType: false): done when completed and not current, edit when current", async () => {
    let api!: StepperApi;
    render(() => <Simple api={(a) => (api = a)} stepper={{ displayDefaultIndicatorType: false }} steps={[{ completed: true }]} />);
    await settle();
    expect(headers()[0]).toHaveAttribute("data-state", "number");
    api.select(1);
    await settle();
    expect(headers()[0]).toHaveAttribute("data-state", "done");
    expect(headers()[1]).toHaveAttribute("data-state", "edit");
  });
});

describe("nesting", () => {
  it("should not pick up the steps from descendant steppers", async () => {
    let outer!: StepperApi;
    let inner!: StepperApi;
    const ProbeOuter = () => ((outer = useStepper()), null);
    const ProbeInner = () => ((inner = useStepper()), null);
    render(() => (
      <Stepper>
        <ProbeOuter />
        <Step label="A">
          <StepHeader />
          <StepPanel>
            <Stepper>
              <ProbeInner />
              <Step label="a1" />
              <Step label="a2" />
              <Step label="a3" />
            </Stepper>
          </StepPanel>
        </Step>
        <Step label="B">
          <StepHeader />
        </Step>
      </Stepper>
    ));
    await settle();
    expect(outer.stepCount()).toBe(2);
    expect(inner.stepCount()).toBe(3);
  });

  it("should be able to change steps when steps are indirect descendants", async () => {
    let api!: StepperApi;
    const Wrapper = (p: { children?: unknown }) => <section>{p.children as never}</section>;
    render(() => (
      <Stepper>
        {(() => {
          api = useStepper();
          return null;
        })()}
        <Wrapper>
          <Step label="A">
            <StepHeader />
          </Step>
        </Wrapper>
        <Wrapper>
          <Step label="B">
            <StepHeader />
          </Step>
        </Wrapper>
      </Stepper>
    ));
    await settle();
    click(headers()[1]!);
    await settle();
    expect(api.selectedIndex()).toBe(1);
  });
});

describe("two-way selectedIndex", () => {
  it("should update the signal on navigation and follow it", async () => {
    const index = signal(0);
    render(() => <Simple stepper={{ selectedIndex: index }} />);
    await settle();
    click(headers()[1]!);
    await settle();
    expect(index()).toBe(1);
    index.set(2);
    await settle();
    expect(headers()[2]).toHaveAttribute("aria-selected", "true");
  });

  it("plain controlled index only calls the callback", async () => {
    const calls: number[] = [];
    render(() => <Simple stepper={{ selectedIndex: 0, onSelectedIndexChange: (i) => calls.push(i) }} />);
    await settle();
    click(headers()[2]!);
    await settle();
    expect(calls).toEqual([2]);
    expect(headers()[0]).toHaveAttribute("aria-selected", "true");
  });
});

describe("list semantics (Rivet)", () => {
  function List(props: { readOnly?: boolean; index?: Signal<number> }) {
    return (
      <Stepper id="ls" semantics="list" isReadOnly={props.readOnly} selectedIndex={props.index} aria-label="Progress">
        {["A", "B", "C"].map((label) => (
          <Step label={label} class="step">
            <StepHeader />
          </Step>
        ))}
      </Stepper>
    );
  }

  it("renders an ordered list with aria-current and button headers", async () => {
    const index = signal(0);
    render(() => <List index={index} />);
    await settle();
    const ol = document.querySelector("ol")!;
    expect(ol).toHaveAttribute("aria-label", "Progress");
    const items = [...document.querySelectorAll("li.step")];
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAttribute("aria-current", "step");
    const buttons = [...document.querySelectorAll("li button")] as HTMLButtonElement[];
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).not.toHaveAttribute("role");
    expect(buttons[0]).not.toHaveAttribute("tabindex");
    click(buttons[2]!);
    await settle();
    expect(index()).toBe(2);
    expect(items[2]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(items[0]).toHaveAttribute("data-completed", "true");
  });

  it("does not handle arrow keys (native Tab order)", async () => {
    render(() => <List />);
    await settle();
    const buttons = [...document.querySelectorAll("li button")] as HTMLButtonElement[];
    buttons[0]!.focus();
    key(buttons[0]!, "ArrowRight");
    await settle();
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("isReadOnly renders plain headers", async () => {
    render(() => <List readOnly />);
    await settle();
    expect(document.querySelector("li button")).toBeNull();
    expect(document.querySelectorAll(".rv-StepHeader")).toHaveLength(3);
  });
});

describe("render props / parts (Rivet)", () => {
  it("passes step render props to class / children functions", async () => {
    let api!: StepperApi;
    render(() => (
      <Simple
        api={(a) => (api = a)}
        steps={[{ class: ({ isSelected }) => (isSelected() ? "on" : "off") }, { class: ({ isSelected }) => (isSelected() ? "on" : "off") }]}
      />
    ));
    await settle();
    const steps = [...document.querySelectorAll(".rv-StepList > *")];
    expect(steps[0]).toHaveClass("on");
    expect(steps[1]).toHaveClass("off");
    api.select(1);
    await settle();
    expect(steps[0]).toHaveClass("off");
    expect(steps[1]).toHaveClass("on");
  });

  it("useStep exposes the step render props; StepLabel defaults to the label", async () => {
    let first!: ReturnType<typeof useStep>;
    const Probe = () => ((first = useStep()), null);
    render(() => (
      <Stepper>
        <Step label="Alpha">
          <Probe />
          <StepHeader>
            <StepLabel />
          </StepHeader>
        </Step>
        <Step label="Beta">
          <StepHeader />
        </Step>
      </Stepper>
    ));
    await settle();
    expect(first.index()).toBe(0);
    expect(first.isSelected()).toBe(true);
    expect(first.isLast()).toBe(false);
    expect(document.querySelector(".rv-StepLabel")).toHaveTextContent("Alpha");
    expect(document.querySelector(".rv-StepLabel")).toHaveAttribute("data-selected", "true");
  });

  it("render prop replaces the header element", async () => {
    render(() => (
      <Stepper>
        <StepList>
          <Step label="A">
            <StepHeader render={(p) => <span {...(p as {})} class="custom" />} />
          </Step>
        </StepList>
      </Stepper>
    ));
    await settle();
    const h = document.querySelector("span.custom")!;
    expect(h).toHaveAttribute("role", "tab");
    expect(h).toHaveAttribute("aria-selected", "true");
    expect(h).toHaveTextContent("A");
  });
});
