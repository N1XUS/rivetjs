// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/form/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Form } from "@rivetjs/ui/form";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "Form: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <Form class="flex w-80 flex-col gap-3 rounded-xl border border-border/80 bg-surface p-4 shadow-sm" onSubmit={(e) => e.preventDefault()}>
      <TextField isRequired name="email" type="email">
        <Label>Work email</Label>
        <Input class="bg-field" placeholder="you@company.com" />
      </TextField>
      <Button class="w-full" type="submit">
        Continue
      </Button>
    </Form>
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
