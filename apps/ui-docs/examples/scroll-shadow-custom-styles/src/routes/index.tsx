// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/scroll-shadow/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ScrollShadow } from "@rivetjs/ui/scroll-shadow";

export const head = { title: "ScrollShadow: Tailwind CSS" };

// #region demo
const entries = [
  "Reviewed quarterly goals with the design team.",
  "Shipped dark mode tokens to production.",
  "Merged accessibility fixes for form fields.",
  "Published updated component documentation.",
  "Scheduled performance audit for next sprint.",
  "Added scroll shadow demos to the docs site.",
];

export function CustomStyles() {
  return (
    <div class="w-full sm:max-w-sm">
      <ScrollShadow
        hideScrollBar
        class="max-h-48 rounded-xl border border-border/80 bg-linear-to-b from-neutral-50/90 to-white p-4 ring-1 ring-black/5 dark:from-neutral-900/80 dark:to-neutral-900 dark:ring-white/10"
        size={48}
        variant="fade"
      >
        <div class="space-y-3">
          {entries.map((entry) => (
            <p class="text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">{entry}</p>
          ))}
        </div>
      </ScrollShadow>
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
