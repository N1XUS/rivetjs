// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/modal/custom-backdrop.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Sparkles } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";

export const head = { title: "Modal: Custom Backdrop" };

// #region demo
export function CustomBackdrop() {
  return (
    <Modal>
      <Button variant="secondary">Custom Backdrop</Button>
      <Modal.Backdrop class="bg-linear-to-t from-black/80 via-black/40 to-transparent dark:from-zinc-800/80 dark:via-zinc-800/40" variant="blur">
        <Modal.Container>
          <Modal.Dialog class="sm:max-w-[360px]">
            <Modal.Header class="items-center text-center">
              <Modal.Icon class="bg-accent-soft text-accent-soft-foreground">
                <Icon icon={Sparkles} class="size-5" />
              </Modal.Icon>
              <Modal.Heading>Premium Backdrop</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p>
                This backdrop features a sophisticated gradient that transitions from a dark color at the bottom to complete transparency at the top, combined
                with a smooth blur effect. The gradient automatically adapts its intensity for optimal contrast in both light and dark modes.
              </p>
            </Modal.Body>
            <Modal.Footer class="flex-col-reverse">
              <Button class="w-full" slot="close">
                Amazing!
              </Button>
              <Button class="w-full" slot="close" variant="secondary">
                Close
              </Button>
            </Modal.Footer>
            <Modal.CloseTrigger />
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
      <CustomBackdrop />
    </div>
  );
}
