// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/typography/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Typography } from "@rivetjs/ui/typography";

export const head = { title: "Typography: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <div class="flex max-w-md flex-col gap-2 rounded-xl border border-border/80 bg-surface-secondary p-4">
      <Typography class="text-xs font-medium tracking-wide text-accent uppercase" type="body-xs">
        Changelog
      </Typography>
      <Typography class="font-semibold tracking-tight text-foreground" type="h4">
        Faster search results
      </Typography>
      <Typography class="text-sm leading-relaxed text-muted" type="body-sm">
        Queries now return in under 200ms thanks to an improved index.
      </Typography>
    </div>
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
