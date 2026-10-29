// Rivet-authored demo (Stepper is a Rivet addition: feature set scoped from public docs of commercial UI kits; independent implementation on @rivetjs/cdk/stepper).
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/ui/button";
import { Stepper } from "@rivetjs/ui/stepper";

export const head = { title: "Stepper: Onboarding Timeline" };

// #region demo
export function StepperOnboardingTimeline() {
  const step = signal(1);
  const tasks = [
    { title: "Create your account", description: "Signed up with your work email.", action: "" },
    { title: "Verify your email", description: "Open the link we sent to confirm the address.", action: "I verified it" },
    { title: "Invite teammates", description: "Projects are better together.", action: "Send invites" },
    { title: "Create a first project", description: "Start from a template or a blank page.", action: "Create project" },
  ];
  return (
    <div class="flex w-96 flex-col gap-5">
      <div class="flex items-baseline justify-between">
        <span class="text-lg font-semibold">Get started</span>
        <span id="stepper-onboarding-timeline-state" class="text-sm text-muted">
          {Math.min(step(), tasks.length)} of {tasks.length} done
        </span>
      </div>
      {/* An accessor currentStep keeps the steps display only, so each step can hold its own action button. */}
      <Stepper id="stepper-onboarding-timeline" aria-label="Onboarding" orientation="vertical" currentStep={() => step()}>
        {tasks.map((task) => (
          <Stepper.Step>
            {(state) => (
              <>
                <Stepper.Indicator />
                <Stepper.Content class="items-start">
                  <Stepper.Title>{task.title}</Stepper.Title>
                  <Stepper.Description>{task.description}</Stepper.Description>
                  <Show when={state.status() === "active"}>
                    {() => (
                      <Button id="stepper-onboarding-timeline-action" size="sm" class="mt-2" onPress={() => step.set(step() + 1)}>
                        {task.action}
                      </Button>
                    )}
                  </Show>
                </Stepper.Content>
                <Stepper.Separator />
              </>
            )}
          </Stepper.Step>
        ))}
      </Stepper>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <StepperOnboardingTimeline />
    </div>
  );
}
