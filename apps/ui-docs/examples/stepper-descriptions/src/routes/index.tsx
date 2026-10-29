// Rivet-authored demo (Stepper is a Rivet addition: feature set inspired by HeroUI Pro's public docs; independent implementation on @rivetjs/cdk/stepper).
import { Stepper } from "@rivetjs/ui/stepper";

export const head = { title: "Stepper: With Descriptions" };

// #region demo
export function StepperDescriptions() {
  return (
    <Stepper id="stepper-descriptions" aria-label="Project setup" defaultStep={1} class="w-[600px]">
      <Stepper.Step>
        <Stepper.Indicator />
        <Stepper.Content>
          <Stepper.Title>Workspace</Stepper.Title>
          <Stepper.Description>Name and URL</Stepper.Description>
        </Stepper.Content>
        <Stepper.Separator />
      </Stepper.Step>
      <Stepper.Step>
        <Stepper.Indicator />
        <Stepper.Content>
          <Stepper.Title>Members</Stepper.Title>
          <Stepper.Description>Invite your team</Stepper.Description>
        </Stepper.Content>
        <Stepper.Separator />
      </Stepper.Step>
      <Stepper.Step>
        <Stepper.Indicator />
        <Stepper.Content>
          <Stepper.Title>Billing</Stepper.Title>
          <Stepper.Description>Choose a plan</Stepper.Description>
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
      <StepperDescriptions />
    </div>
  );
}
