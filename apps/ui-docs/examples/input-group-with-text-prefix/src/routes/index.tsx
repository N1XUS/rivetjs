// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/with-text-prefix.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { InputGroup } from "@rivetjs/ui/input-group";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "InputGroup: Text Prefix" };

// #region demo
export function WithTextPrefix() {
  return (
    <TextField class="w-full max-w-[280px]" defaultValue="rivetjs.dev" name="website">
      <Label>Website</Label>
      <InputGroup>
        <InputGroup.Prefix>https://</InputGroup.Prefix>
        <InputGroup.Input class="w-full max-w-[280px]" />
      </InputGroup>
    </TextField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithTextPrefix />
    </div>
  );
}
