// Rivet-authored demo (Stepper is a Rivet addition: feature set inspired by HeroUI Pro's public docs; independent implementation on @rivetjs/cdk/stepper).
import { Stepper } from "@rivetjs/ui/stepper";

export const head = { title: "Stepper: Bullet" };

// #region demo
export function StepperBullet() {
  return (
    <Stepper id="stepper-bullet" aria-label="Project setup" defaultStep={1} class="w-[520px]">
      <Stepper.Step>
        <Stepper.Indicator>
          <Stepper.Icon />
        </Stepper.Indicator>
        <Stepper.Content>
          <Stepper.Title>Workspace</Stepper.Title>
        </Stepper.Content>
        <Stepper.Separator />
      </Stepper.Step>
      <Stepper.Step>
        <Stepper.Indicator>
          <Stepper.Icon />
        </Stepper.Indicator>
        <Stepper.Content>
          <Stepper.Title>Members</Stepper.Title>
        </Stepper.Content>
        <Stepper.Separator />
      </Stepper.Step>
      <Stepper.Step>
        <Stepper.Indicator>
          <Stepper.Icon />
        </Stepper.Indicator>
        <Stepper.Content>
          <Stepper.Title>Integrations</Stepper.Title>
        </Stepper.Content>
        <Stepper.Separator />
      </Stepper.Step>
      <Stepper.Step>
        <Stepper.Indicator>
          <Stepper.Icon />
        </Stepper.Indicator>
        <Stepper.Content>
          <Stepper.Title>Launch</Stepper.Title>
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
      <StepperBullet />
    </div>
  );
}
