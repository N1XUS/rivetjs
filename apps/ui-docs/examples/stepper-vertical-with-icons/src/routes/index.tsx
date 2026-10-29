// Rivet-authored demo (Stepper is a Rivet addition: feature set scoped from public docs of commercial UI kits; independent implementation on @rivetjs/cdk/stepper).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Stepper } from "@rivetjs/ui/stepper";
import { KeyRound, Palette, ShieldCheck, UserRound } from "lucide";

export const head = { title: "Stepper: Vertical With Icons" };

// #region demo
export function StepperVerticalWithIcons() {
  const step = signal(1);
  const steps = [
    { title: "Profile", description: "Name and photo", icon: UserRound },
    { title: "Password", description: "At least 12 characters", icon: KeyRound },
    { title: "Two-factor", description: "Authenticator app", icon: ShieldCheck },
    { title: "Appearance", description: "Theme and density", icon: Palette },
  ];
  return (
    <Stepper id="stepper-vertical-with-icons" aria-label="Account setup" orientation="vertical" class="w-72" currentStep={step}>
      {steps.map((item) => (
        <Stepper.Step>
          <Stepper.Indicator>
            <Stepper.Icon>
              <Icon icon={item.icon} size={16} />
            </Stepper.Icon>
          </Stepper.Indicator>
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
      <StepperVerticalWithIcons />
    </div>
  );
}
