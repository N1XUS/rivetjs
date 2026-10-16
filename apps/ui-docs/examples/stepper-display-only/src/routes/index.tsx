// Rivet-authored demo (Stepper is a Rivet addition: feature set inspired by HeroUI Pro's public docs; independent implementation on @rivetjs/cdk/stepper).
import { Stepper } from "@rivetjs/ui/stepper";

export const head = { title: "Stepper: Display only" };

// #region demo
export function StepperDisplayOnly() {
  return (
    <Stepper id="stepper-display-only" aria-label="Order progress" currentStep={2} class="w-[520px]">
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
          <Stepper.Title>Packed</Stepper.Title>
        </Stepper.Content>
        <Stepper.Separator />
      </Stepper.Step>
      <Stepper.Step>
        <Stepper.Indicator />
        <Stepper.Content>
          <Stepper.Title>Shipped</Stepper.Title>
        </Stepper.Content>
        <Stepper.Separator />
      </Stepper.Step>
      <Stepper.Step>
        <Stepper.Indicator />
        <Stepper.Content>
          <Stepper.Title>Delivered</Stepper.Title>
        </Stepper.Content>
        <Stepper.Separator />
      </Stepper.Step>
    </Stepper>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <StepperDisplayOnly />
    </div>
  );
}
