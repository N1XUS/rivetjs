// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/with-text-suffix.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { InputGroup } from "@rivetjs/ui/input-group";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "InputGroup: Text Suffix" };

// #region demo
export function WithTextSuffix() {
  return (
    <TextField class="w-full max-w-[280px]" defaultValue="rivet" name="website">
      <Label>Website</Label>
      <InputGroup>
        <InputGroup.Input class="w-full max-w-[280px]" />
        <InputGroup.Suffix>.com</InputGroup.Suffix>
      </InputGroup>
    </TextField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithTextSuffix />
    </div>
  );
}
