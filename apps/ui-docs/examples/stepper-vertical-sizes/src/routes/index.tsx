// Rivet-authored demo (Stepper is a Rivet addition: feature set scoped from public docs of commercial UI kits; independent implementation on @rivetjs/cdk/stepper).
import { Stepper } from "@rivetjs/ui/stepper";

export const head = { title: "Stepper: Vertical Sizes" };

// #region demo
export function StepperVerticalSizes() {
  return (
    <div class="flex flex-wrap items-start justify-center gap-10">
      {(["sm", "md", "lg"] as const).map((size) => (
        <Stepper id={`stepper-vertical-size-${size}`} aria-label={`Order (${size})`} orientation="vertical" size={size} defaultStep={1}>
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
        </Stepper>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <StepperVerticalSizes />
    </div>
  );
}
