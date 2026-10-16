// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Mail } from "lucide";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "InputGroup: Variants" };

// #region demo
export function Variants() {
  return (
    <div class="flex flex-col gap-4">
      <TextField class="w-[280px]" name="primary">
        <Label>Primary variant</Label>
        <InputGroup variant="primary">
          <InputGroup.Prefix>
            <Icon icon={Mail} class="size-4 text-muted" />
          </InputGroup.Prefix>
          <InputGroup.Input placeholder="name@email.com" />
        </InputGroup>
      </TextField>
      <TextField class="w-[280px]" name="secondary">
        <Label>Secondary variant</Label>
        <InputGroup variant="secondary">
          <InputGroup.Prefix>
            <Icon icon={Mail} class="size-4 text-muted" />
          </InputGroup.Prefix>
          <InputGroup.Input placeholder="name@email.com" />
        </InputGroup>
      </TextField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Variants />
    </div>
  );
}
