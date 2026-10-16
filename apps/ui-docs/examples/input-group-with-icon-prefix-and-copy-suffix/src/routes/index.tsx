// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/with-icon-prefix-and-copy-suffix.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Copy, Globe } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "InputGroup: Icon Prefix and Copy Button" };

// #region demo
export function WithIconPrefixAndCopySuffix() {
  return (
    <TextField class="w-full max-w-[280px]" defaultValue="rivetjs.dev" name="website">
      <Label>Website</Label>
      <InputGroup>
        <InputGroup.Prefix>
          <Icon icon={Globe} class="size-4 text-muted" />
        </InputGroup.Prefix>
        <InputGroup.Input class="w-full max-w-[280px]" />
        <InputGroup.Suffix>
          <Button isIconOnly aria-label="Copy" size="sm" variant="ghost">
            <Icon icon={Copy} class="size-4" />
          </Button>
        </InputGroup.Suffix>
      </InputGroup>
    </TextField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithIconPrefixAndCopySuffix />
    </div>
  );
}
