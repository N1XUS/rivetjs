// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/card/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Check, Star } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";

export const head = { title: "Card: Tailwind CSS" };

// #region demo
const PRO_FEATURES = ["Unlimited projects and collaborators", "Priority support with 24h response", "Advanced analytics and exports"] as const;

export function CustomStyles() {
  return (
    <Card class="relative w-full max-w-md overflow-hidden border border-accent/20 bg-linear-to-br from-accent/12 via-surface to-surface-secondary shadow-lg shadow-accent/10 dark:border-accent/30 dark:from-accent/20 dark:via-surface dark:to-accent/8 dark:shadow-accent/5">
      <div aria-hidden="true" class="pointer-events-none absolute -top-12 -right-12 size-40 rounded-full bg-accent/20 blur-3xl dark:bg-accent/30" />
      <div aria-hidden="true" class="pointer-events-none absolute -bottom-8 -left-8 size-28 rounded-full bg-accent/10 blur-2xl dark:bg-accent/20" />

      <Card.Header class="relative gap-3">
        <span class="w-fit rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium tracking-wide text-accent dark:bg-accent/25 dark:text-accent-soft-foreground">
          Recommended
        </span>
        <div class="flex items-start gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-accent dark:bg-accent/20 dark:text-accent-soft-foreground">
            <Icon icon={Star} size={16} aria-hidden="true" class="size-5" />
          </div>
          <div class="flex flex-col gap-1">
            <Card.Title>Upgrade to Pro</Card.Title>
            <Card.Description>Unlock team workflows and insights built for growing products.</Card.Description>
          </div>
        </div>
      </Card.Header>

      <Card.Content class="relative">
        <ul class="flex flex-col gap-2">
          {PRO_FEATURES.map((feature) => (
            <li class="flex items-center gap-2 text-sm text-muted">
              <Icon icon={Check} size={16} aria-hidden="true" class="size-4 shrink-0 text-accent" />
              {feature}
            </li>
          ))}
        </ul>
      </Card.Content>

      <Card.Footer class="relative flex-col gap-2 sm:flex-row">
        <Button class="w-full shadow-md shadow-accent/20">Upgrade now</Button>
        <Button class="w-full" variant="secondary">
          Compare plans
        </Button>
      </Card.Footer>
    </Card>
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
