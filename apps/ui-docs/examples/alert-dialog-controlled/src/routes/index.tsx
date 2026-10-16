// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/alert-dialog/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { useOverlayState } from "@rivetjs/ui";
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "AlertDialog: Controlled State" };

// #region demo
export function Controlled() {
  const isOpen = signal(false);

  const state = useOverlayState();

  return (
    <div class="flex max-w-md flex-col gap-8">
      <div class="flex flex-col gap-3">
        <h3 class="text-lg font-semibold text-foreground">With signal()</h3>
        <p class="text-sm leading-relaxed text-pretty text-muted">
          Control the alert dialog with a <code class="text-foreground">signal</code>: it is two-way, so closing the dialog writes it back. Perfect for basic
          use cases.
        </p>
        <div class="flex flex-col items-start gap-3 rounded-2xl bg-surface p-4 shadow-sm">
          <div class="flex w-full items-center justify-between">
            <p class="text-xs text-muted">
              Status: <span class="font-mono font-medium text-foreground">{isOpen() ? "open" : "closed"}</span>
            </p>
          </div>
          <div class="flex gap-2">
            <Button size="sm" variant="secondary" onPress={() => isOpen.set(true)}>
              Open Dialog
            </Button>
            <Button size="sm" variant="tertiary" onPress={() => isOpen.set(!isOpen())}>
              Toggle
            </Button>
          </div>
        </div>

        <AlertDialog.Backdrop isOpen={isOpen}>
          <AlertDialog.Container>
            <AlertDialog.Dialog class="sm:max-w-[400px]">
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="accent" />
                <AlertDialog.Heading>Controlled with signal()</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  This alert dialog is controlled by a <code>signal</code>. Pass it as <code>isOpen</code> to manage the dialog state externally.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  Cancel
                </Button>
                <Button slot="close">Confirm</Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </div>

      <div class="flex flex-col gap-3">
        <h3 class="text-lg font-semibold text-foreground">With useOverlayState()</h3>
        <p class="text-sm leading-relaxed text-pretty text-muted">
          Use the <code class="text-foreground">useOverlayState</code> hook for a cleaner API with convenient methods like <code>open()</code>,{" "}
          <code>close()</code>, and <code>toggle()</code>.
        </p>
        <div class="flex flex-col items-start gap-3 rounded-2xl bg-surface p-4 shadow-sm">
          <div class="flex w-full items-center justify-between">
            <p class="text-xs text-muted">
              Status: <span class="font-mono font-medium text-foreground">{state.isOpen() ? "open" : "closed"}</span>
            </p>
          </div>
          <div class="flex gap-2">
            <Button size="sm" variant="secondary" onPress={() => state.open()}>
              Open Dialog
            </Button>
            <Button size="sm" variant="tertiary" onPress={() => state.toggle()}>
              Toggle
            </Button>
          </div>
        </div>

        <AlertDialog.Backdrop isOpen={state.isOpen} onOpenChange={(open) => state.setOpen(open)}>
          <AlertDialog.Container>
            <AlertDialog.Dialog class="sm:max-w-[400px]">
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="success" />
                <AlertDialog.Heading>Controlled with useOverlayState()</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  The <code>useOverlayState</code> hook provides dedicated methods for common operations. No need to manually create callbacks—just use{" "}
                  <code>state.open()</code>, <code>state.close()</code>, or <code>state.toggle()</code>.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  Cancel
                </Button>
                <Button slot="close">Confirm</Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Controlled />
    </div>
  );
}
