// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/textfield/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "TextField: Tailwind CSS" };

// #region demo
const fieldClass =
  "rounded-xl border border-border/80 bg-surface shadow-sm ring-1 ring-black/5 transition-[box-shadow,border-color] focus-visible:ring-2 focus-visible:ring-neutral-400/25 dark:ring-white/10 dark:focus-visible:ring-neutral-500/30";

export function CustomStyles() {
  return (
    <TextField class="w-full max-w-64 gap-1.5" name="email" type="email">
      <Label class="font-medium text-neutral-800 dark:text-neutral-100">Email</Label>
      <Input
        class={`text-sm text-neutral-800 placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500 ${fieldClass}`}
        placeholder="you@email.com"
      />
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
