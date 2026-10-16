// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Mail } from "lucide";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "InputGroup: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <TextField class="w-full max-w-xs" name="email">
      <Label>Work email</Label>
      <InputGroup class="rounded-xl border border-border/80 bg-default shadow-sm">
        <InputGroup.Prefix>
          <Icon icon={Mail} class="size-4 text-muted" />
        </InputGroup.Prefix>
        <InputGroup.Input placeholder="you@company.com" />
      </InputGroup>
    </TextField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomStyles />
    </div>
  );
}
