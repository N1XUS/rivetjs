// Rivet-authored demo (Stepper is a Rivet addition: feature set scoped from public docs of commercial UI kits; independent implementation on @rivetjs/cdk/stepper).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Stepper } from "@rivetjs/ui/stepper";
import { Sparkles } from "lucide";

export const head = { title: "Stepper: Custom Completed Icon" };

// #region demo
export function StepperCustomCompletedIcon() {
  const step = signal(2);
  return (
    <Stepper id="stepper-custom-completed-icon" aria-label="Course" class="w-[560px]" currentStep={step} onStepChange={(index: number) => step.set(index)}>
      {["Basics", "Signals", "Components", "Routing"].map((title) => (
        <Stepper.Step>
          {(state) => (
            <>
              {/* Indicator children replace the default number / check: keep the number, swap the completed icon. */}
              <Stepper.Indicator>
                <Show when={state.status() === "complete"} fallback={<>{state.index() + 1}</>}>
                  {() => <Icon icon={Sparkles} size={16} data-completed-icon="" />}
                </Show>
              </Stepper.Indicator>
              <Stepper.Content>
                <Stepper.Title>{title}</Stepper.Title>
              </Stepper.Content>
              <Stepper.Separator />
            </>
          )}
        </Stepper.Step>
      ))}
    </Stepper>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <StepperCustomCompletedIcon />
    </div>
  );
}
