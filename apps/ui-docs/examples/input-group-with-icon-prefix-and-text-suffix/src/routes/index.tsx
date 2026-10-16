// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/with-icon-prefix-and-text-suffix.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Globe } from "lucide";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "InputGroup: Icon Prefix and Text Suffix" };

// #region demo
export function WithIconPrefixAndTextSuffix() {
  return (
    <TextField class="w-full max-w-[280px]" defaultValue="rivet" name="website">
      <Label>Website</Label>
      <InputGroup>
        <InputGroup.Prefix>
          <Icon icon={Globe} class="size-4 text-muted" />
        </InputGroup.Prefix>
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
      <WithIconPrefixAndTextSuffix />
    </div>
  );
}
