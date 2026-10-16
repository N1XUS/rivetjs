// Rivet-authored demo (Stepper is a Rivet addition: feature set inspired by HeroUI Pro's public docs; independent implementation on @rivetjs/cdk/stepper).
import { Stepper } from "@rivetjs/ui/stepper";

export const head = { title: "Stepper: Custom color" };

// #region demo
export function StepperCustomColor() {
  return (
    <Stepper
      id="stepper-custom-color"
      aria-label="Onboarding"
      defaultStep={2}
      class="w-[520px] [--stepper-active-color:var(--success)] [--stepper-complete-color:var(--success)] [--stepper-complete-fg:var(--success-foreground)]"
    >
      <Stepper.Step>
        <Stepper.Indicator />
        <Stepper.Content>
          <Stepper.Title>Account</Stepper.Title>
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
          <Stepper.Title>Preferences</Stepper.Title>
        </Stepper.Content>
        <Stepper.Separator />
      </Stepper.Step>
      <Stepper.Step>
        <Stepper.Indicator />
        <Stepper.Content>
          <Stepper.Title>Done</Stepper.Title>
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
      <StepperCustomColor />
    </div>
  );
}
