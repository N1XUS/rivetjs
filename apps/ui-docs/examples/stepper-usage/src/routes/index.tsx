// Rivet-authored demo (Stepper is a Rivet addition: feature set inspired by HeroUI Pro's public docs; independent implementation on @rivetjs/cdk/stepper).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Stepper } from "@rivetjs/ui/stepper";

export const head = { title: "Stepper: Usage" };

// #region demo
export function StepperUsage() {
  const step = signal(0);
  return (
    <div class="flex w-[560px] flex-col gap-6">
      <Stepper id="stepper-usage" aria-label="Checkout" currentStep={step} onStepChange={(index: number) => step.set(index)}>
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
      <div class="flex justify-end gap-2">
        <Button id="stepper-usage-back" variant="secondary" isDisabled={() => step() === 0} onPress={() => step.set(Math.max(0, step() - 1))}>
          Back
        </Button>
        <Button id="stepper-usage-next" isDisabled={() => step() === 3} onPress={() => step.set(Math.min(3, step() + 1))}>
          Next
        </Button>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <StepperUsage />
    </div>
  );
}
