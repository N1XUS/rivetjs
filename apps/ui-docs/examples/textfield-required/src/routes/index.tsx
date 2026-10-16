// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/textfield/required.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "TextField: Required Field" };

// #region demo
export function Required() {
  return (
    <TextField isRequired class="w-full max-w-64" name="fullName">
      <Label>Full Name</Label>
      <Input placeholder="John Doe" />
      <Description>This field is required</Description>
    </TextField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Required />
    </div>
  );
}
