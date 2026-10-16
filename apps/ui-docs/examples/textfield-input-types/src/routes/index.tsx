// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/textfield/input-types.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "TextField: Input Types" };

// #region demo
export function InputTypes() {
  return (
    <div class="flex w-full max-w-64 flex-col gap-4">
      <TextField name="password" type="password">
        <Label>Password</Label>
        <Input placeholder="••••••••" />
      </TextField>

      <TextField name="age" type="number">
        <Label>Age</Label>
        <Input max="150" min="0" placeholder="21" />
      </TextField>

      <TextField name="email" type="email">
        <Label>Email</Label>
        <Input placeholder="user@example.com" />
      </TextField>

      <TextField name="website" type="url">
        <Label>Website</Label>
        <Input placeholder="https://example.com" />
      </TextField>

      <TextField name="phone" type="tel">
        <Label>Phone</Label>
        <Input placeholder="+1 (555) 000-0000" />
      </TextField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <InputTypes />
    </div>
  );
}
