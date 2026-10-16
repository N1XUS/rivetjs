// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/disclosure/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { ShoppingBag } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Disclosure } from "@rivetjs/ui/disclosure";

export const head = { title: "Disclosure: Custom Styles" };

// #region demo
export function CustomStyles() {
  const isExpanded = signal(false);

  return (
    <div class="w-full max-w-sm">
      <Disclosure isExpanded={isExpanded}>
        <Disclosure.Heading>
          <Button
            class="w-full justify-between rounded-xl border border-border/70 bg-linear-to-b from-neutral-50/90 to-white px-4 py-3 font-medium text-foreground shadow-sm ring-1 ring-black/5 hover:bg-muted/30 dark:from-neutral-900/80 dark:to-neutral-900 dark:ring-white/10"
            slot="trigger"
            variant="ghost"
          >
            <span class="flex items-center gap-2">
              <Icon class="size-4 text-muted" icon={ShoppingBag} />
              Shipping details
            </span>
            <Disclosure.Indicator class="text-muted" />
          </Button>
        </Disclosure.Heading>
        <Disclosure.Content>
          <Disclosure.Body class="mt-2 rounded-xl border border-border/70 bg-surface/50 p-4 text-sm leading-relaxed text-muted dark:bg-neutral-900/50">
            Orders ship within 2 business days. Standard delivery takes 3–5 days; express is available at checkout.
          </Disclosure.Body>
        </Disclosure.Content>
      </Disclosure>
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
