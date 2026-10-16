// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/textfield/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "TextField: Usage" };

// #region demo
export function Basic() {
  return (
    <TextField class="w-full max-w-64" name="email" type="email">
      <Label>Email</Label>
      <Input placeholder="Enter your email" />
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
