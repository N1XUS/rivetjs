// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/textfield/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "TextField: Disabled State" };

// #region demo
export function Disabled() {
  return (
    <TextField isDisabled class="w-full max-w-64" name="accountId" value="USR-12345">
      <Label>Account ID</Label>
      <Input placeholder="Auto-generated" />
      <Description>This field cannot be edited</Description>
    </TextField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Disabled />
    </div>
  );
}
