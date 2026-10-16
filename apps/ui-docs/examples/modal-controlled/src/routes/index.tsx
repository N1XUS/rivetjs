// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/modal/controlled.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { CircleCheck } from "lucide";
import { signal } from "@rivetjs/reactivity";
import { useOverlayState } from "@rivetjs/ui";
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";

export const head = { title: "Modal: Controlled State" };

// #region demo
export function Controlled() {
  const isOpen = signal(false);

  const state = useOverlayState();

  return (
    <div class="flex max-w-md flex-col gap-8">
      <div class="flex flex-col gap-3">
        <h3 class="text-lg font-semibold text-foreground">With signal()</h3>
        <p class="text-sm leading-relaxed text-pretty text-muted">
          Control the modal with a <code class="text-foreground">signal</code>: it is two-way, so closing the modal writes it back. Perfect for basic use cases.
        </p>
        <div class="flex flex-col items-start gap-3 rounded-2xl bg-surface p-4 shadow-sm">
          <div class="flex w-full items-center justify-between">
            <p class="text-xs text-muted">
              Status: <span class="font-mono font-medium text-foreground">{isOpen() ? "open" : "closed"}</span>
            </p>
          </div>
          <div class="flex gap-2">
            <Button size="sm" variant="secondary" onPress={() => isOpen.set(true)}>
              Open Modal
            </Button>
            <Button size="sm" variant="tertiary" onPress={() => isOpen.set(!isOpen())}>
              Toggle
            </Button>
          </div>
        </div>

        <Modal.Content isOpen={isOpen} class="sm:max-w-[360px]">
          <Modal.Header>
            <Modal.Icon class="bg-accent-soft text-accent-soft-foreground">
              <Icon icon={CircleCheck} class="size-5" />
            </Modal.Icon>
            <Modal.Heading>Controlled with signal()</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p>
              This modal is controlled by a <code>signal</code>. Pass it as <code>isOpen</code> to manage the modal state externally.
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancel
            </Button>
            <Button slot="close">Confirm</Button>
          </Modal.Footer>
        </Modal.Content>
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
              Open Modal
            </Button>
            <Button size="sm" variant="tertiary" onPress={() => state.toggle()}>
              Toggle
            </Button>
          </div>
        </div>

        <Modal.Content isOpen={state.isOpen} onOpenChange={(open) => state.setOpen(open)} class="sm:max-w-[360px]">
          <Modal.Header>
            <Modal.Icon class="bg-success-soft text-success-soft-foreground">
              <Icon icon={CircleCheck} class="size-5" />
            </Modal.Icon>
            <Modal.Heading>Controlled with useOverlayState()</Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p>
              The <code>useOverlayState</code> hook provides dedicated methods for common operations. No need to manually create callbacks—just use{" "}
              <code>state.open()</code>, <code>state.close()</code>, or <code>state.toggle()</code>.
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button slot="close" variant="secondary">
              Cancel
            </Button>
            <Button slot="close">Confirm</Button>
          </Modal.Footer>
        </Modal.Content>
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
