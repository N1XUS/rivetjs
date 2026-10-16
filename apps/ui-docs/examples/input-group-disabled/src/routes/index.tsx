// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/disabled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Mail } from "lucide";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "InputGroup: Disabled State" };

// #region demo
export function Disabled() {
  return (
    <div class="flex flex-col gap-4">
      <TextField isDisabled class="w-full max-w-[280px]" defaultValue="name@email.com" name="email">
        <Label>Email address</Label>
        <InputGroup>
          <InputGroup.Prefix>
            <Icon icon={Mail} class="size-4 text-muted" />
          </InputGroup.Prefix>
          <InputGroup.Input class="w-full max-w-[280px]" />
        </InputGroup>
      </TextField>
      <TextField isDisabled class="w-full max-w-[280px]" defaultValue="10" name="price">
        <Label>Set a price</Label>
        <InputGroup>
          <InputGroup.Prefix>$</InputGroup.Prefix>
          <InputGroup.Input class="w-full max-w-[200px]" type="number" />
          <InputGroup.Suffix>USD</InputGroup.Suffix>
        </InputGroup>
      </TextField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Disabled />
    </div>
  );
}
