// Rivet addition (no upstream demo): Stepper Step shorthand, same parts as the compound form.
import { Stepper } from "@rivetjs/ui/stepper";

export const head = { title: "Stepper: Shorthand" };

// #region demo
export function Shorthand() {
  return (
    <Stepper aria-label="Project setup" defaultStep={1} class="w-[600px]">
      <Stepper.Step title="Workspace" description="Name and URL" />
      <Stepper.Step title="Members" description="Invite your team" />
      <Stepper.Step title="Billing" description="Pick a plan" />
    </Stepper>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Shorthand />
    </div>
  );
}
