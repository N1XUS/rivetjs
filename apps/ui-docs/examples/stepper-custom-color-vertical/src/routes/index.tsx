// Rivet-authored demo (Stepper is a Rivet addition: feature set scoped from public docs of commercial UI kits; independent implementation on @rivetjs/cdk/stepper).
import { Stepper } from "@rivetjs/ui/stepper";

export const head = { title: "Stepper: Custom Color Vertical" };

// #region demo
export function StepperCustomColorVertical() {
  const steps = [
    { title: "Draft", description: "Written by Mia" },
    { title: "Review", description: "Approved by 2 reviewers" },
    { title: "Staging", description: "Deploying preview" },
    { title: "Production", description: "Scheduled for 14:00" },
  ];
  return (
    <Stepper
      id="stepper-custom-color-vertical"
      aria-label="Release"
      orientation="vertical"
      defaultStep={2}
      class="w-72 [--stepper-active-color:var(--warning)] [--stepper-complete-color:var(--warning)] [--stepper-complete-fg:var(--warning-foreground)]"
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
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <StepperCustomColorVertical />
    </div>
  );
}
