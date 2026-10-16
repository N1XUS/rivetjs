// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/alert-dialog/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "AlertDialog: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <AlertDialog>
      <Button variant="secondary">Sign out</Button>
      <AlertDialog.Backdrop class="bg-overlay/50 dark:bg-overlay/60" variant="blur">
        <AlertDialog.Container>
          <AlertDialog.Dialog class="relative overflow-hidden border border-border/80 bg-surface shadow-2xl ring-1 ring-accent/10 sm:max-w-[400px] dark:border-border/90 dark:bg-surface dark:ring-accent/15">
            <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-accent/6 to-transparent dark:from-accent/10" />
            <div
              aria-hidden="true"
              class="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-accent/35 to-transparent dark:via-accent/45"
            />
            <AlertDialog.Header class="relative">
              <AlertDialog.Icon status="accent" />
              <AlertDialog.Heading>Sign out of your account?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body class="relative">
              <p class="text-muted">
                You will be signed out on this device. Unsaved work in <strong class="text-foreground">Acme Workspace</strong> may be lost unless it was saved
                to the cloud.
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Stay signed in
              </Button>
              <Button slot="close">Sign out</Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
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
