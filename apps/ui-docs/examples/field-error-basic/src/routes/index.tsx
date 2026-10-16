// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/field-error/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { FieldError } from "@rivetjs/ui/field-error";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "FieldError: Usage" };

// #region demo
// Rivet: the TextField holds the value (two-way signal) and `isInvalid` is an accessor; the field links the label to the input.
export function Basic() {
  const value = signal("jr");
  const isInvalid = () => value().length > 0 && value().length < 3;

  return (
    <TextField class="w-64" isInvalid={isInvalid} value={value}>
      <Label>Username</Label>
      <Input placeholder="Enter username" />
      <FieldError>Username must be at least 3 characters</FieldError>
    </TextField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
