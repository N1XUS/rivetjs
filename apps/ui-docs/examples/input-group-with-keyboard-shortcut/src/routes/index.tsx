// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/with-keyboard-shortcut.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { InputGroup } from "@rivetjs/ui/input-group";
import { Kbd } from "@rivetjs/ui/kbd";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "InputGroup: Keyboard Shortcut" };

// #region demo
export function WithKeyboardShortcut() {
  return (
    <TextField aria-label="Command" class="w-full max-w-[280px]" name="command">
      <InputGroup>
        <InputGroup.Input class="w-full max-w-[280px]" placeholder="Command" />
        <InputGroup.Suffix class="pe-2">
          <Kbd>
            <Kbd.Abbr keyValue="command" />
            <Kbd.Content>K</Kbd.Content>
          </Kbd>
        </InputGroup.Suffix>
      </InputGroup>
    </TextField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithKeyboardShortcut />
    </div>
  );
}
