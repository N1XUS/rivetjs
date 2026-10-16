// Type-level checks for `@rivetjs/ui/stepper` (tsc -p libs/ui only).
import { signal } from "@rivetjs/reactivity";
import { Stepper, useStepperStep } from "../src/components/stepper/index.ts";
import type { StepperStepStatus } from "../src/components/stepper/index.ts";

const current = signal(0);

export const ok = () => (
  <Stepper currentStep={current} onStepChange={(i: number) => current.set(i)} orientation="vertical" size="lg" class="x" aria-label="Steps">
    <Stepper.Step class="s" buttonClass="b">
      <Stepper.Indicator>
        <Stepper.Icon />
      </Stepper.Indicator>
      <Stepper.Content>
        <Stepper.Title>A</Stepper.Title>
        <Stepper.Description>B</Stepper.Description>
      </Stepper.Content>
      <Stepper.Separator progress={0.5} force />
    </Stepper.Step>
    <Stepper.Step>{({ status }) => <span>{status()}</span>}</Stepper.Step>
  </Stepper>
);

export const status = (): StepperStepStatus => useStepperStep().status();

// @ts-expect-error bad size
export const badSize = () => <Stepper size="xl" />;
// @ts-expect-error bad orientation
export const badOrientation = () => <Stepper orientation="diagonal" />;
// @ts-expect-error progress is a number
export const badProgress = () => <Stepper.Separator progress="half" />;
