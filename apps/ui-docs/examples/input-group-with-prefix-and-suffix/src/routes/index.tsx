// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/with-prefix-and-suffix.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Description } from "@rivetjs/ui/description";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "InputGroup: With Prefix and Suffix" };

// #region demo
export function WithPrefixAndSuffix() {
  return (
    <TextField class="w-full max-w-[280px]" defaultValue="10" name="price">
      <Label>Set a price</Label>
      <InputGroup>
        <InputGroup.Prefix>$</InputGroup.Prefix>
        <InputGroup.Input class="w-full max-w-[200px]" type="number" />
        <InputGroup.Suffix>USD</InputGroup.Suffix>
      </InputGroup>
      <Description>What customers would pay</Description>
    </TextField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithPrefixAndSuffix />
    </div>
  );
}
