// Rivet-authored demo (Stepper is a Rivet addition: feature set scoped from public docs of commercial UI kits; independent implementation on @rivetjs/cdk/stepper).
import { Icon } from "@rivetjs/kit/icon";
import { Button } from "@rivetjs/ui/button";
import { Stepper } from "@rivetjs/ui/stepper";
import { Bell, CreditCard, LockOpen } from "lucide";

export const head = { title: "Stepper: Free Trial Timeline" };

// #region demo
export function StepperFreeTrialTimeline() {
  const events = [
    { title: "Today: full access", description: "Every Pro feature unlocks right away.", icon: LockOpen },
    { title: "Day 12: reminder", description: "We email you two days before the trial ends.", icon: Bell },
    { title: "Day 14: trial ends", description: "You are billed $12 / month. Cancel any time before.", icon: CreditCard },
  ];
  return (
    <div class="flex w-96 flex-col gap-6 rounded-3xl bg-surface p-6 shadow-surface">
      <div class="flex flex-col gap-1">
        <span class="text-lg font-semibold">How your free trial works</span>
        <span class="text-sm text-muted">No charge for 14 days.</span>
      </div>
      <Stepper id="stepper-free-trial-timeline" aria-label="Free trial timeline" orientation="vertical" defaultStep={0}>
        {events.map((event) => (
          <Stepper.Step>
            <Stepper.Indicator>
              <Stepper.Icon>
                <Icon icon={event.icon} size={16} />
              </Stepper.Icon>
            </Stepper.Indicator>
            <Stepper.Content>
              <Stepper.Title>{event.title}</Stepper.Title>
              <Stepper.Description>{event.description}</Stepper.Description>
            </Stepper.Content>
            <Stepper.Separator />
          </Stepper.Step>
        ))}
      </Stepper>
      <Button fullWidth>Start free trial</Button>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <StepperFreeTrialTimeline />
    </div>
  );
}
