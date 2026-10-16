// Rivet-authored demo (Stepper is a Rivet addition: feature set inspired by HeroUI Pro's public docs; independent implementation on @rivetjs/cdk/stepper).
import { Stepper } from "@rivetjs/ui/stepper";

export const head = { title: "Stepper: Sizes" };

// #region demo
export function StepperSizes() {
  return (
    <div class="flex w-[520px] flex-col gap-10">
      {(["sm", "md", "lg"] as const).map((size) => (
        <Stepper id={`stepper-size-${size}`} aria-label={`Order (${size})`} size={size} defaultStep={1}>
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
      <StepperSizes />
    </div>
  );
}
