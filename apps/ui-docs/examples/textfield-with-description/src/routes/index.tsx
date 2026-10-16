// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/textfield/with-description.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "TextField: With Description" };

// #region demo
export function WithDescription() {
  return (
    <TextField class="w-full max-w-64" name="username">
      <Label>Username</Label>
      <Input placeholder="Enter username" />
      <Description>Choose a unique username for your account</Description>
    </TextField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithDescription />
    </div>
  );
}
