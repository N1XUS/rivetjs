// DOM-target suite: `Stepper` (Rivet addition; feature set inspired by HeroUI Pro's public Stepper docs, independent
// implementation; behaviour = `@rivetjs/cdk/stepper` list semantics): part classes + data-slots, `ol` / `li` markup with
// `aria-current="step"`, index-based `data-status`, default indicator (number → lucide check), separator progress (auto,
// explicit, clamped) + `force`, `onStepChange` makes steps buttons (`data-clickable`), display-only without it, controlled
// `currentStep` (two-way Signal + live prop), `defaultStep`, step function children + `useStepperStep`, bullet `Icon`,
// orientation / size modifiers, index exports.
import { test } from "vitest";
import assert from "node:assert/strict";
import { installOverlayDom } from "./install-overlay-dom.ts";

installOverlayDom();

const { render } = await import("@rivetjs/runtime/testing");
const { signal } = await import("@rivetjs/reactivity");
const ui = await import("../src/components/stepper/index.ts");
const { Stepper, useStepperStep } = ui;

const flush = () => new Promise((r) => setTimeout(r, 20));
const q = (root: ParentNode, sel: string) => root.querySelector(sel) as HTMLElement | null;
const qa = (root: ParentNode, sel: string) => [...root.querySelectorAll(sel)] as HTMLElement[];
const steps = (root: ParentNode) => qa(root, '[data-slot="stepper-step"]');
const statuses = (root: ParentNode) => steps(root).map((s) => s.getAttribute("data-status"));

const TITLES = ["Account", "Profile", "Review"];

interface FixtureProps {
  currentStep?: number | ReturnType<typeof signal<number>>;
  defaultStep?: number;
  onStepChange?: (index: number) => void;
  orientation?: "horizontal" | "vertical";
  size?: "sm" | "md" | "lg";
}

const Fixture = (props: FixtureProps) => (
  <Stepper
    aria-label="Checkout"
    data-testid="stepper"
    currentStep={props.currentStep as never}
    defaultStep={props.defaultStep}
    onStepChange={props.onStepChange}
    orientation={props.orientation}
    size={props.size}
  >
    <Stepper.Step>
      <Stepper.Indicator />
      <Stepper.Content>
        <Stepper.Title>Account</Stepper.Title>
        <Stepper.Description>Sign in</Stepper.Description>
      </Stepper.Content>
      <Stepper.Separator />
    </Stepper.Step>
    <Stepper.Step>
      <Stepper.Indicator />
      <Stepper.Content>
        <Stepper.Title>Profile</Stepper.Title>
      </Stepper.Content>
      <Stepper.Separator />
    </Stepper.Step>
    <Stepper.Step>
      <Stepper.Indicator />
      <Stepper.Content>
        <Stepper.Title>Review</Stepper.Title>
      </Stepper.Content>
      <Stepper.Separator />
    </Stepper.Step>
  </Stepper>
);

test("markup: ol / li, part classes + data-slots, aria-current, orientation + size modifiers", () => {
  const r = render(() => <Fixture />);
  const root = q(r.container, '[data-testid="stepper"]')!;
  assert.equal(root.tagName, "OL");
  assert.equal(root.getAttribute("data-slot"), "stepper");
  assert.equal(root.getAttribute("aria-label"), "Checkout");
  assert.match(root.className, /\bstepper\b/);
  assert.match(root.className, /stepper--horizontal/);
  assert.match(root.className, /stepper--md/);
  assert.equal(steps(r.container).length, 3);
  for (const s of steps(r.container)) {
    assert.equal(s.tagName, "LI");
    assert.match(s.className, /stepper__step\b/);
  }
  for (const [slot, cls] of [
    ["stepper-step-button", "stepper__step-button"],
    ["stepper-indicator", "stepper__indicator"],
    ["stepper-content", "stepper__content"],
    ["stepper-title", "stepper__title"],
    ["stepper-description", "stepper__description"],
    ["stepper-separator", "stepper__separator"],
    ["stepper-separator-track", "stepper__separator-track"],
    ["stepper-separator-fill", "stepper__separator-fill"],
  ])
    assert.match(q(r.container, `[data-slot="${slot}"]`)!.className, new RegExp(cls!), slot);
  assert.equal(steps(r.container)[0]!.getAttribute("aria-current"), "step");
  assert.equal(steps(r.container)[1]!.hasAttribute("aria-current"), false);
  assert.deepEqual(
    qa(r.container, ".stepper__title").map((t) => t.textContent),
    TITLES,
  );
  r.unmount();
  const v = render(() => <Fixture orientation="vertical" size="lg" />);
  const vroot = q(v.container, '[data-testid="stepper"]')!;
  assert.match(vroot.className, /stepper--vertical/);
  assert.match(vroot.className, /stepper--lg/);
  assert.equal(vroot.getAttribute("data-orientation"), "vertical");
  v.unmount();
});

test("display only without onStepChange: div headers, no data-clickable", () => {
  const r = render(() => <Fixture defaultStep={1} />);
  const button = q(r.container, '[data-slot="stepper-step-button"]')!;
  assert.equal(button.tagName, "DIV");
  assert.equal(button.hasAttribute("data-clickable"), false);
  button.click();
  assert.deepEqual(statuses(r.container), ["complete", "active", "inactive"]);
  r.unmount();
});

test("status + default indicator: number, then lucide check once complete", () => {
  const r = render(() => <Fixture defaultStep={1} />);
  assert.deepEqual(statuses(r.container), ["complete", "active", "inactive"]);
  const indicators = qa(r.container, '[data-slot="stepper-indicator"]');
  assert.deepEqual(
    indicators.map((i) => i.getAttribute("data-status")),
    ["complete", "active", "inactive"],
  );
  assert.ok(q(indicators[0]!, 'svg[data-slot="stepper-check"]'));
  assert.equal(indicators[1]!.textContent, "2");
  assert.equal(indicators[2]!.textContent, "3");
  r.unmount();
});

test("default indicator: a completed step keeps its check while the current step moves on (no redraw)", async () => {
  const current = signal(0);
  const r = render(() => <Fixture currentStep={current} />);
  const check = (i: number) => q(qa(r.container, '[data-slot="stepper-indicator"]')[i]!, 'svg[data-slot="stepper-check"]');
  current.set(1);
  await flush();
  const first = check(0);
  assert.ok(first);
  current.set(2);
  await flush();
  // Booleans: a failing assert on happy-dom nodes inspects their whole object graph (GBs).
  assert.ok(check(0) === first, "step 0 check kept");
  assert.ok(check(1));
  current.set(0);
  await flush();
  assert.ok(check(0) === null);
  assert.deepEqual(
    qa(r.container, '[data-slot="stepper-indicator"]').map((i) => i.textContent),
    ["1", "2", "3"],
  );
  r.unmount();
});

test("onStepChange: buttons with data-clickable, click selects any step (non-linear)", async () => {
  const calls: number[] = [];
  const r = render(() => <Fixture onStepChange={(i) => calls.push(i)} />);
  const buttons = qa(r.container, '[data-slot="stepper-step-button"]');
  assert.ok(buttons.every((b) => b.tagName === "BUTTON" && b.getAttribute("type") === "button" && b.getAttribute("data-clickable") === "true"));
  buttons[2]!.click();
  await flush();
  assert.deepEqual(calls, [2]);
  assert.deepEqual(statuses(r.container), ["complete", "complete", "active"]);
  assert.equal(steps(r.container)[2]!.getAttribute("aria-current"), "step");
  r.unmount();
});

test("controlled currentStep: two-way Signal and live prop", async () => {
  const current = signal(0);
  const r = render(() => <Fixture currentStep={current} />);
  assert.equal(q(r.container, '[data-slot="stepper-step-button"]')!.tagName, "BUTTON");
  qa(r.container, '[data-slot="stepper-step-button"]')[1]!.click();
  await flush();
  assert.equal(current(), 1);
  current.set(2);
  await flush();
  assert.deepEqual(statuses(r.container), ["complete", "complete", "active"]);
  r.unmount();

  const live = signal(0);
  const calls: number[] = [];
  const l = render(() => <Fixture currentStep={live()} onStepChange={(i) => calls.push(i)} />);
  const before = steps(l.container)[0];
  live.set(2);
  await flush();
  assert.deepEqual(statuses(l.container), ["complete", "complete", "active"]);
  assert.equal(steps(l.container)[0], before, "nodes kept");
  qa(l.container, '[data-slot="stepper-step-button"]')[0]!.click();
  await flush();
  assert.deepEqual(calls, [0]);
  l.unmount();
});

test("separator: auto progress follows status, explicit progress clamped, force", async () => {
  const current = signal(0);
  const r = render(() => (
    <Stepper currentStep={current}>
      <Stepper.Step>
        <Stepper.Indicator />
        <Stepper.Separator />
      </Stepper.Step>
      <Stepper.Step>
        <Stepper.Indicator />
        <Stepper.Separator progress={0.5} />
      </Stepper.Step>
      <Stepper.Step>
        <Stepper.Indicator />
        <Stepper.Separator progress={4} force />
      </Stepper.Step>
    </Stepper>
  ));
  const fills = () => qa(r.container, '[data-slot="stepper-separator-fill"]').map((f) => f.style.getPropertyValue("--stepper-separator-progress"));
  assert.deepEqual(fills(), ["0", "0.5", "1"]);
  current.set(1);
  await flush();
  assert.deepEqual(fills(), ["1", "0.5", "1"]);
  const tracks = qa(r.container, '[data-slot="stepper-separator-track"]');
  assert.equal(tracks[0]!.getAttribute("data-complete"), "true");
  assert.equal(tracks[1]!.hasAttribute("data-complete"), false);
  const seps = qa(r.container, '[data-slot="stepper-separator"]');
  assert.equal(seps[2]!.getAttribute("data-force"), "true");
  assert.equal(seps[0]!.hasAttribute("data-force"), false);
  assert.ok(seps.every((s) => s.getAttribute("aria-hidden") === "true"));
  r.unmount();
});

test("custom indicator children, bullet Icon, step function children + useStepperStep", async () => {
  const current = signal(1);
  const Status = () => {
    const step = useStepperStep();
    return (
      <span class="probe">
        {step.index()}:{step.status()}
      </span>
    );
  };
  const r = render(() => (
    <Stepper currentStep={current}>
      <Stepper.Step>
        <Stepper.Indicator>
          <Stepper.Icon />
        </Stepper.Indicator>
        <Status />
      </Stepper.Step>
      <Stepper.Step>{({ status }: { status: () => string }) => <span class="fn">{status()}</span>}</Stepper.Step>
    </Stepper>
  ));
  const icon = q(r.container, '[data-slot="stepper-icon"]')!;
  assert.match(icon.className, /stepper__icon/);
  assert.equal(icon.childNodes.length, 0, "empty icon = bullet");
  assert.equal(q(r.container, ".probe")!.textContent, "0:complete");
  assert.equal(q(r.container, ".fn")!.textContent, "active");
  current.set(0);
  await flush();
  assert.equal(q(r.container, ".probe")!.textContent, "0:active");
  assert.equal(q(r.container, ".fn")!.textContent, "inactive");
  r.unmount();
});

test("index exports", () => {
  for (const k of ["Root", "Step", "Indicator", "Icon", "Content", "Title", "Description", "Separator"])
    assert.equal(typeof (Stepper as unknown as Record<string, unknown>)[k], "function", k);
  assert.equal(ui.StepperRoot, Stepper);
  assert.equal(typeof ui.stepperVariants, "function");
  assert.equal(typeof ui.useStepperStep, "function");
});

test("Step shorthand: title / description parts, press moves the step, check once complete", async () => {
  const step = signal(0);
  const r = render(() => (
    <Stepper aria-label="Checkout" currentStep={step}>
      <Stepper.Step title="Cart" description="Your items" />
      <Stepper.Step title="Pay" />
    </Stepper>
  ));
  assert.deepEqual(
    qa(r.container, "[data-slot=stepper-title]").map((e) => e.textContent),
    ["Cart", "Pay"],
  );
  assert.equal(q(r.container, "[data-slot=stepper-description]")!.textContent, "Your items");
  assert.equal(qa(r.container, "[data-slot=stepper-indicator]").length, 2);
  assert.equal(qa(r.container, "[data-slot=stepper-separator]").length, 2);
  step.set(1);
  await flush();
  assert.equal(qa(r.container, "li")[0]!.getAttribute("data-status"), "complete");
  r.unmount();
});
