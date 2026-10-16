// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/with-badge-suffix.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Chip } from "@rivetjs/ui/chip";
import { InputGroup } from "@rivetjs/ui/input-group";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "InputGroup: Badge Suffix" };

// #region demo
export function WithBadgeSuffix() {
  return (
    <TextField aria-label="Email address" class="w-full max-w-[280px]" name="email">
      <InputGroup>
        <InputGroup.Input class="w-full max-w-[280px]" placeholder="Email address" />
        <InputGroup.Suffix class="pe-2">
          <Chip color="accent" size="md" variant="soft">
            Pro
          </Chip>
        </InputGroup.Suffix>
      </InputGroup>
    </TextField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithBadgeSuffix />
    </div>
  );
}
