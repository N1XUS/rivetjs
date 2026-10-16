// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/popover/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Popover } from "@rivetjs/ui/popover";

export const head = { title: "Popover: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <Popover>
      <Button variant="secondary">Details</Button>
      <Popover.Content
        class="max-w-56 overflow-hidden rounded-xl border border-border/80 bg-surface/90 p-0 shadow-xl ring-1 ring-black/5 backdrop-blur-xl dark:border-border/90 dark:bg-surface/85 dark:ring-white/10"
        dialog={false}
      >
        <Popover.Dialog class="relative p-4">
          <div
            aria-hidden="true"
            class="pointer-events-none absolute inset-x-0 top-0 h-12 bg-linear-to-b from-neutral-500/6 to-transparent dark:from-neutral-400/8"
          />
          <Popover.Heading class="relative font-medium text-neutral-800 dark:text-neutral-100">Keyboard shortcuts</Popover.Heading>
          <dl class="relative mt-3 space-y-2 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-muted">Save</dt>
              <dd class="font-mono text-neutral-700 dark:text-neutral-300">⌘ S</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-muted">Search</dt>
              <dd class="font-mono text-neutral-700 dark:text-neutral-300">⌘ K</dd>
            </div>
          </dl>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
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
