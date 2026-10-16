// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/with-copy-suffix.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Copy } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "InputGroup: Copy Button Suffix" };

// #region demo
export function WithCopySuffix() {
  return (
    <TextField class="w-full max-w-[280px]" defaultValue="rivetjs.dev" name="website">
      <Label>Website</Label>
      <InputGroup>
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
      <WithCopySuffix />
    </div>
  );
}
