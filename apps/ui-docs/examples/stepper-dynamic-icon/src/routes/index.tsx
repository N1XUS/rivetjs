// Rivet-authored demo (Stepper is a Rivet addition: feature set scoped from public docs of commercial UI kits; independent implementation on @rivetjs/cdk/stepper).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/ui/button";
import { Stepper } from "@rivetjs/ui/stepper";
import { Check, CloudUpload, FileCheck, LoaderCircle, Rocket } from "lucide";

export const head = { title: "Stepper: Dynamic Icon" };

// #region demo
export function StepperDynamicIcon() {
  const step = signal(1);
  const steps = [
    { title: "Upload", icon: CloudUpload },
    { title: "Validate", icon: FileCheck },
    { title: "Publish", icon: Rocket },
  ];
  return (
    <div class="flex w-[520px] flex-col gap-6">
      <Stepper id="stepper-dynamic-icon" aria-label="Deployment" currentStep={() => step()}>
        {steps.map((item) => (
          <Stepper.Step>
            {(state) => (
              <>
                {/* The icon follows the step status: check when done, spinner while running, the step icon when upcoming. */}
                <Stepper.Indicator>
                  <Stepper.Icon>
                    <Show when={state.status() === "complete"}>{() => <Icon icon={Check} size={16} stroke-width={3} data-icon="complete" />}</Show>
                    <Show when={state.status() === "active"}>
                      {() => <Icon icon={LoaderCircle} size={16} class="motion-safe:animate-spin" data-icon="active" />}
                    </Show>
                    <Show when={state.status() === "inactive"}>{() => <Icon icon={item.icon} size={16} data-icon="inactive" />}</Show>
                  </Stepper.Icon>
                </Stepper.Indicator>
                <Stepper.Content>
                  <Stepper.Title>{item.title}</Stepper.Title>
                </Stepper.Content>
                <Stepper.Separator />
              </>
            )}
          </Stepper.Step>
        ))}
      </Stepper>
      <div class="flex justify-end gap-2">
        <Button id="stepper-dynamic-icon-reset" variant="secondary" size="sm" onPress={() => step.set(0)}>
          Restart
        </Button>
        <Button id="stepper-dynamic-icon-next" size="sm" onPress={() => step.set(Math.min(steps.length, step() + 1))}>
          Next
        </Button>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <StepperDynamicIcon />
    </div>
  );
}
