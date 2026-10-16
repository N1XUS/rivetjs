// Stepper on a resumed page: `#st` interactive (onStepChange → `#st-state`, Back / Next buttons drive the same signal);
// `#st-still` display only (defaultStep 1); `#st-v` vertical; `#st-short` Stepper.Step shorthand (`title` / `description`),
// `onStepChange` → `#st-short-state`.
import { signal } from "@rivetjs/reactivity";
import { Stepper } from "@rivetjs/ui/stepper";

export default function StepperStories() {
  const step = signal(0);
  const shortStep = signal(0);
  return (
    <section class="flex w-[640px] flex-col gap-10 p-10">
      <span id="st-state">{step()}</span>
      <Stepper id="st" aria-label="Checkout" currentStep={step} onStepChange={(i: number) => step.set(i)}>
        <Stepper.Step>
          <Stepper.Indicator />
          <Stepper.Content>
            <Stepper.Title>Cart</Stepper.Title>
            <Stepper.Description>Review items</Stepper.Description>
          </Stepper.Content>
          <Stepper.Separator />
        </Stepper.Step>
        <Stepper.Step>
          <Stepper.Indicator />
          <Stepper.Content>
            <Stepper.Title>Shipping</Stepper.Title>
          </Stepper.Content>
          <Stepper.Separator />
        </Stepper.Step>
        <Stepper.Step>
          <Stepper.Indicator />
          <Stepper.Content>
            <Stepper.Title>Payment</Stepper.Title>
          </Stepper.Content>
          <Stepper.Separator />
        </Stepper.Step>
      </Stepper>
      <div class="flex gap-2">
        <button id="st-back" type="button" onClick={() => step.set(Math.max(0, step() - 1))}>
          Back
        </button>
        <button id="st-next" type="button" onClick={() => step.set(Math.min(2, step() + 1))}>
          Next
        </button>
      </div>
      <Stepper id="st-still" defaultStep={1}>
        <Stepper.Step>
          <Stepper.Indicator />
          <Stepper.Content>
            <Stepper.Title>Ordered</Stepper.Title>
          </Stepper.Content>
          <Stepper.Separator />
        </Stepper.Step>
        <Stepper.Step>
          <Stepper.Indicator />
          <Stepper.Content>
            <Stepper.Title>Shipped</Stepper.Title>
          </Stepper.Content>
        </Stepper.Step>
      </Stepper>
      <Stepper id="st-v" orientation="vertical" size="sm" defaultStep={1}>
        <Stepper.Step>
          <Stepper.Indicator />
          <Stepper.Content>
            <Stepper.Title>One</Stepper.Title>
          </Stepper.Content>
          <Stepper.Separator />
        </Stepper.Step>
        <Stepper.Step>
          <Stepper.Indicator />
          <Stepper.Content>
            <Stepper.Title>Two</Stepper.Title>
          </Stepper.Content>
        </Stepper.Step>
      </Stepper>
      <Stepper id="st-short" aria-label="Signup" currentStep={shortStep} onStepChange={(i: number) => shortStep.set(i)}>
        <Stepper.Step title="Account" description="Email and password" />
        <Stepper.Step title="Profile" />
        <Stepper.Step title="Done" />
      </Stepper>
      <span id="st-short-state">{shortStep()}</span>
    </section>
  );
}
