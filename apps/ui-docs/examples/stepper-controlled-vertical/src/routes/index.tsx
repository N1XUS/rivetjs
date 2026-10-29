// Rivet-authored demo (Stepper is a Rivet addition: feature set inspired by HeroUI Pro's public docs; independent implementation on @rivetjs/cdk/stepper).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Stepper } from "@rivetjs/ui/stepper";

export const head = { title: "Stepper: Controlled Vertical" };

// #region demo
export function StepperControlledVertical() {
  const step = signal(1);
  const steps = [
    { title: "Workspace", description: "Name and URL" },
    { title: "Members", description: "Invite your team" },
    { title: "Integrations", description: "Connect GitHub and Slack" },
    { title: "Billing", description: "Choose a plan" },
  ];
  return (
    <div class="flex w-80 flex-col gap-6">
      <Stepper
        id="stepper-controlled-vertical"
        aria-label="Workspace setup"
        orientation="vertical"
        currentStep={step}
        onStepChange={(index: number) => step.set(index)}
      >
        {steps.map((item) => (
          <Stepper.Step>
            <Stepper.Indicator />
            <Stepper.Content>
              <Stepper.Title>{item.title}</Stepper.Title>
              <Stepper.Description>{item.description}</Stepper.Description>
            </Stepper.Content>
            <Stepper.Separator />
          </Stepper.Step>
        ))}
      </Stepper>
      <div class="flex items-center justify-between gap-2">
        <span id="stepper-controlled-vertical-state" class="text-sm text-muted">
          Step {step() + 1} of {steps.length}
        </span>
        <div class="flex gap-2">
          <Button id="stepper-controlled-vertical-back" variant="secondary" size="sm" onPress={() => step.set(Math.max(0, step() - 1))}>
            Back
          </Button>
          <Button id="stepper-controlled-vertical-next" size="sm" onPress={() => step.set(Math.min(steps.length - 1, step() + 1))}>
            Next
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
      <StepperControlledVertical />
    </div>
  );
}
