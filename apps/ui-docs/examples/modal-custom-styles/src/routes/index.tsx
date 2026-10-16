// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/modal/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { CircleCheck } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";

export const head = { title: "Modal: Tailwind CSS" };

// #region demo
export function CustomStyles() {
  return (
    <Modal>
      <Button variant="secondary">Open</Button>
      <Modal.Backdrop class="bg-overlay/50 dark:bg-overlay/65" variant="blur">
        <Modal.Container>
          <Modal.Dialog class="relative overflow-hidden border border-border/80 bg-surface/90 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl sm:max-w-[340px] dark:border-border/90 dark:bg-surface/85 dark:ring-white/10">
            <div
              aria-hidden="true"
              class="pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-b from-neutral-500/8 to-transparent dark:from-neutral-400/10"
            />
            <div
              aria-hidden="true"
              class="pointer-events-none absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-neutral-400/40 to-transparent dark:via-neutral-500/35"
            />
            <Modal.CloseTrigger />
            <Modal.Header class="relative">
              <Modal.Icon class="bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                <Icon icon={CircleCheck} class="size-5" />
              </Modal.Icon>
              <Modal.Heading>Changes saved</Modal.Heading>
            </Modal.Header>
            <Modal.Body class="relative">
              <p class="text-sm text-muted">Your draft is synced across devices.</p>
            </Modal.Body>
            <Modal.Footer>
              <Button class="w-full" slot="close">
                Done
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
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
