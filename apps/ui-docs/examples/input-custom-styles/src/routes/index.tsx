// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/input/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Input } from "@rivetjs/ui/input";

export const head = { title: "Input: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <Input
      aria-label="Search projects"
      class="w-64 rounded-xl border border-border/80 bg-default text-foreground placeholder:text-muted"
      placeholder="Search projects..."
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
