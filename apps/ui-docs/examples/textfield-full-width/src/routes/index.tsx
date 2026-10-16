// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/textfield/full-width.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { FieldError } from "@rivetjs/ui/field-error";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "TextField: Full Width" };

// #region demo
export function FullWidth() {
  return (
    <div class="w-[400px] space-y-4">
      <TextField fullWidth name="name">
        <Label>Your name</Label>
        <Input placeholder="John" />
      </TextField>
      <TextField fullWidth isInvalid isRequired name="password" type="password">
        <Label>Password</Label>
        <Input />
        <FieldError>Password must be longer than 8 characters</FieldError>
      </TextField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FullWidth />
    </div>
  );
}
