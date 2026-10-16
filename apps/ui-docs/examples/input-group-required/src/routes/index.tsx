// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/required.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Mail } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "InputGroup: Required Field" };

// #region demo
export function Required() {
  return (
    <div class="flex flex-col gap-4">
      <TextField isRequired class="w-full max-w-[280px]" name="email">
        <Label>Email address</Label>
        <InputGroup>
          <InputGroup.Prefix>
            <Icon icon={Mail} class="size-4 text-muted" />
          </InputGroup.Prefix>
          <InputGroup.Input class="w-full max-w-[280px]" placeholder="name@email.com" />
        </InputGroup>
      </TextField>
      <TextField isRequired class="w-full max-w-[280px]" name="price">
        <Label>Set a price</Label>
        <InputGroup>
          <InputGroup.Prefix>$</InputGroup.Prefix>
          <InputGroup.Input class="w-full max-w-[200px]" placeholder="0" type="number" />
          <InputGroup.Suffix>USD</InputGroup.Suffix>
        </InputGroup>
        <Description>What customers would pay</Description>
      </TextField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Required />
    </div>
  );
}
