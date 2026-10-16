// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/textfield/with-error.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { FieldError } from "@rivetjs/ui/field-error";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "TextField: Error Message" };

// #region demo
export function WithError() {
  return (
    <TextField isInvalid class="w-full max-w-64" name="email" type="email">
      <Label>Email</Label>
      <Input placeholder="user@example.com" />
      <FieldError>Please enter a valid email address</FieldError>
    </TextField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithError />
    </div>
  );
}
