// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox/invalid.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Checkbox } from "@rivetjs/ui/checkbox";
import { FieldError } from "@rivetjs/ui/field-error";

export const head = { title: "Checkbox: Invalid" };

// #region demo
export function Invalid() {
  return (
    <Checkbox isInvalid isRequired name="agreement">
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        I agree to the terms
      </Checkbox.Content>
      <FieldError>You must accept the terms to continue</FieldError>
    </Checkbox>
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
