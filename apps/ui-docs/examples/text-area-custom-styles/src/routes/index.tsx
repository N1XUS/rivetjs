// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/textarea/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { TextArea } from "@rivetjs/ui/textarea";

export const head = { title: "TextArea: Tailwind CSS" };

// #region demo
const fieldClass =
  "rounded-xl border border-border/80 bg-surface shadow-sm ring-1 ring-black/5 transition-[box-shadow,border-color] focus-visible:ring-2 focus-visible:ring-neutral-400/25 dark:ring-white/10 dark:focus-visible:ring-neutral-500/30";

export function CustomStyles() {
  return (
    <TextArea
      aria-label="Notes"
      class={`h-28 w-full max-w-xs text-sm text-neutral-800 placeholder:text-neutral-400 dark:text-neutral-100 dark:placeholder:text-neutral-500 ${fieldClass}`}
      placeholder="Add a note..."
    />
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
