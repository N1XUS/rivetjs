// Rivet-authored demo (Stepper is a Rivet addition: feature set inspired by HeroUI Pro's public docs; independent implementation on @rivetjs/cdk/stepper).
import { Stepper } from "@rivetjs/ui/stepper";

export const head = { title: "Stepper: Vertical" };

// #region demo
export function StepperVertical() {
  return (
    <Stepper id="stepper-vertical" aria-label="Hiring pipeline" orientation="vertical" defaultStep={2} class="w-72">
      <Stepper.Step>
        <Stepper.Indicator />
        <Stepper.Content>
          <Stepper.Title>Application</Stepper.Title>
          <Stepper.Description>Received on 2 June</Stepper.Description>
        </Stepper.Content>
        <Stepper.Separator />
      </Stepper.Step>
      <Stepper.Step>
        <Stepper.Indicator />
        <Stepper.Content>
          <Stepper.Title>Screening call</Stepper.Title>
          <Stepper.Description>30 minutes with the recruiter</Stepper.Description>
        </Stepper.Content>
        <Stepper.Separator />
      </Stepper.Step>
      <Stepper.Step>
        <Stepper.Indicator />
        <Stepper.Content>
          <Stepper.Title>Technical interview</Stepper.Title>
          <Stepper.Description>Pairing session</Stepper.Description>
        </Stepper.Content>
        <Stepper.Separator />
      </Stepper.Step>
      <Stepper.Step>
        <Stepper.Indicator />
        <Stepper.Content>
          <Stepper.Title>Offer</Stepper.Title>
          <Stepper.Description>Pending</Stepper.Description>
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
      <StepperVertical />
    </div>
  );
}
