// Rivet-authored demo (Stepper is a Rivet addition: feature set scoped from public docs of commercial UI kits; independent implementation on @rivetjs/cdk/stepper).
import { Stepper } from "@rivetjs/ui/stepper";

export const head = { title: "Stepper: Render function" };

// #region demo
export function StepperRenderFunction() {
  const labels = { complete: "Done", active: "In progress", inactive: "Up next" };
  return (
    <Stepper id="stepper-render-function" aria-label="Release" defaultStep={1} class="w-[560px]">
      {["Build", "Test", "Deploy"].map((title) => (
        <Stepper.Step>
          {(state) => (
            <>
              <Stepper.Indicator />
              <Stepper.Content>
                <Stepper.Title>{title}</Stepper.Title>
                <Stepper.Description>{labels[state.status()]}</Stepper.Description>
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
      <StepperRenderFunction />
    </div>
  );
}
