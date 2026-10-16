// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/password-with-toggle.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Eye, EyeOff } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "InputGroup: Password Toggle" };

// #region demo
export function PasswordWithToggle() {
  const isVisible = signal(false);

  return (
    <TextField class="w-full max-w-[280px]" name="password">
      <Label>Password</Label>
      <InputGroup>
        <InputGroup.Input class="w-full max-w-[280px]" type={isVisible() ? "text" : "password"} value={isVisible() ? "87$2h.3diua" : "••••••••"} />
        <InputGroup.Suffix>
          <Button isIconOnly aria-label={isVisible() ? "Hide password" : "Show password"} size="sm" variant="ghost" onPress={() => isVisible.set(!isVisible())}>
            {isVisible() ? <Icon icon={Eye} class="size-4" /> : <Icon icon={EyeOff} class="size-4" />}
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
      <PasswordWithToggle />
    </div>
  );
}
