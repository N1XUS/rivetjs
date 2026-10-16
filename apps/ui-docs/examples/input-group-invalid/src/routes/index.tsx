// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/invalid.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Mail } from "lucide";
import { FieldError } from "@rivetjs/ui/field-error";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "InputGroup: Validation" };

// #region demo
export function Invalid() {
  return (
    <div class="flex flex-col gap-4">
      <TextField isInvalid isRequired class="w-full max-w-[280px]" name="email">
        <Label>Email address</Label>
        <InputGroup>
          <InputGroup.Prefix>
            <Icon icon={Mail} class="size-4 text-muted" />
          </InputGroup.Prefix>
          <InputGroup.Input class="w-full max-w-[280px]" placeholder="name@email.com" />
        </InputGroup>
        <FieldError>Please enter a valid email address</FieldError>
      </TextField>
      <TextField isInvalid isRequired class="w-full max-w-[280px]" name="price">
        <Label>Set a price</Label>
        <InputGroup>
          <InputGroup.Prefix>$</InputGroup.Prefix>
          <InputGroup.Input class="w-full max-w-[200px]" placeholder="0" type="number" />
          <InputGroup.Suffix>USD</InputGroup.Suffix>
        </InputGroup>
        <FieldError>Price must be greater than 0</FieldError>
      </TextField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Invalid />
    </div>
  );
}
