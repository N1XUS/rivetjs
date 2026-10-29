// Rivet-authored demo (Stepper is a Rivet addition: feature set scoped from public docs of commercial UI kits; independent implementation on @rivetjs/cdk/stepper).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Stepper } from "@rivetjs/ui/stepper";

export const head = { title: "Stepper: Controlled" };

// #region demo
export function StepperControlled() {
  const step = signal(1);
  return (
    <div class="flex w-[560px] flex-col gap-6">
      <Stepper id="stepper-controlled" aria-label="Checkout" currentStep={step} onStepChange={(index: number) => step.set(index)}>
        <Stepper.Step>
          <Stepper.Indicator />
          <Stepper.Content>
            <Stepper.Title>Cart</Stepper.Title>
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
        <Stepper.Step>
          <Stepper.Indicator />
          <Stepper.Content>
            <Stepper.Title>Review</Stepper.Title>
          </Stepper.Content>
          <Stepper.Separator />
        </Stepper.Step>
      </Stepper>
      <div class="flex items-center justify-between gap-2">
        <span id="stepper-controlled-state" class="text-sm text-muted">
          Step {step() + 1} of 4
        </span>
        <div class="flex gap-2">
          <Button variant="secondary" size="sm" onPress={() => step.set(0)}>
            Start over
          </Button>
          <Button id="stepper-controlled-next" size="sm" onPress={() => step.set(Math.min(3, step() + 1))}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <StepperControlled />
    </div>
  );
}
