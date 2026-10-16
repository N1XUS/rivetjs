// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/alert/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Alert } from "@rivetjs/ui/alert";
import { Button } from "@rivetjs/ui/button";
import { CloseButton } from "@rivetjs/ui/close-button";

export const head = { title: "Alert: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <div class="w-full max-w-xl">
      <Alert
        class="relative overflow-hidden rounded-xl border border-warning/20 bg-linear-to-br from-warning/10 via-surface to-surface-secondary shadow-sm dark:border-warning/30 dark:from-warning/15 dark:via-surface dark:to-warning/5"
        status="warning"
      >
        <div aria-hidden="true" class="pointer-events-none absolute -top-8 -right-8 size-28 rounded-full bg-warning/15 blur-2xl dark:bg-warning/25" />
        <Alert.Indicator class="relative text-warning" />
        <Alert.Content class="relative">
          <Alert.Title>Payment method expires soon</Alert.Title>
          <Alert.Description>Your Visa ending in 4242 expires on March 28. Update billing to avoid interrupting your Pro subscription.</Alert.Description>
          <Button class="mt-3 sm:hidden" size="sm" variant="tertiary">
            Update billing
          </Button>
        </Alert.Content>
        <Button class="relative hidden shrink-0 sm:inline-flex" size="sm" variant="tertiary">
          Update billing
        </Button>
        <CloseButton class="relative" />
      </Alert>
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
