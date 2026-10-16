// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/full-width.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Eye, Mail } from "lucide";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "InputGroup: Full Width" };

// #region demo
export function FullWidth() {
  return (
    <div class="w-[400px] space-y-4">
      <TextField fullWidth name="email">
        <Label>Email address</Label>
        <InputGroup fullWidth>
          <InputGroup.Prefix>
            <Icon icon={Mail} class="size-4 text-muted" />
          </InputGroup.Prefix>
          <InputGroup.Input placeholder="name@email.com" />
        </InputGroup>
      </TextField>
      <TextField fullWidth name="password">
        <Label>Password</Label>
        <InputGroup fullWidth>
          <InputGroup.Input placeholder="Enter password" type="password" />
          <InputGroup.Suffix>
            <Icon icon={Eye} class="size-4 text-muted" />
          </InputGroup.Suffix>
        </InputGroup>
      </TextField>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FullWidth />
    </div>
  );
}
