// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/default.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Mail } from "lucide";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "InputGroup: Usage" };

// #region demo
export function Default() {
  return (
    <TextField class="w-full max-w-[280px]" name="email">
      <Label>Email address</Label>
      <InputGroup>
        <InputGroup.Prefix>
          <Icon icon={Mail} class="size-4 text-muted" />
        </InputGroup.Prefix>
        <InputGroup.Input class="w-full max-w-[280px]" placeholder="name@email.com" />
      </InputGroup>
    </TextField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Default />
    </div>
  );
}
