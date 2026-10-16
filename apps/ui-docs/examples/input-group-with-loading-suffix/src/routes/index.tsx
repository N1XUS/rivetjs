// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input-group/with-loading-suffix.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { InputGroup } from "@rivetjs/ui/input-group";
import { Spinner } from "@rivetjs/ui/spinner";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "InputGroup: Loading State" };

// #region demo
export function WithLoadingSuffix() {
  return (
    <TextField class="w-full max-w-[280px]" defaultValue="Sending..." name="status">
      <InputGroup>
        <InputGroup.Input class="w-full max-w-[280px]" />
        <InputGroup.Suffix>
          <Spinner class="size-4" />
        </InputGroup.Suffix>
      </InputGroup>
    </TextField>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithLoadingSuffix />
    </div>
  );
}
