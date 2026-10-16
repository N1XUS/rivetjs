// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/with-prefix-icon.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Mail } from "lucide";
import { Description } from "@rivetjs/ui/description";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "InputGroup: With Prefix Icon" };

// #region demo
export function WithPrefixIcon() {
  return (
    <TextField class="w-full max-w-[280px]" name="email">
      <Label>Email address</Label>
      <InputGroup>
        <InputGroup.Prefix>
          <Icon icon={Mail} class="size-4 text-muted" />
        </InputGroup.Prefix>
        <InputGroup.Input class="w-full max-w-[280px]" placeholder="name@email.com" />
      </InputGroup>
      <Description>We'll never share this with anyone else</Description>
    </TextField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithPrefixIcon />
    </div>
  );
}
