// Rivet addition (no upstream demo): Switch shorthand, same parts as the compound form.
import { Switch } from "@rivetjs/ui/switch";

export const head = { title: "Switch: Shorthand" };

// #region demo
export function Shorthand() {
  return (
    <div class="flex flex-col gap-4">
      <Switch label="Enable notifications" />
      <Switch label="Public profile" description="Allow others to see your profile information" />
    </div>
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
