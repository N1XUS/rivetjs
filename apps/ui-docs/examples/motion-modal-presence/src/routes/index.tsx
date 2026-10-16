// Rivet addition (no HeroUI counterpart): `exit` inside a ui Modal (cdk overlay = kit transition scope).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Sparkles } from "lucide";
import { Motion } from "@rivetjs/motion";
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";

export const head = { title: "Motion: Modal exit" };

// #region demo
export function ModalExit() {
  const isOpen = signal(false);
  return (
    <>
      <Button id="open" variant="secondary" onPress={() => isOpen.set(true)}>
        What's new
      </Button>
      <Modal.Backdrop isOpen={isOpen}>
        <Modal.Container>
          <Modal.Dialog class="sm:max-w-[380px]">
            <Modal.Header>
              <Modal.Icon class="bg-accent-soft text-accent-soft-foreground">
                <Icon icon={Sparkles} class="size-5" />
              </Modal.Icon>
              <Modal.Heading>What's new</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              {/* Plays its exit on close; the modal unmounts after it. */}
              <Motion.ul
                id="panel"
                class="grid gap-2"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ duration: 0.25 }}
              >
                <li>Motion elements in overlays</li>
                <li>Exit animations without a wrapper</li>
                <li>Springs from a motion token</li>
              </Motion.ul>
            </Modal.Body>
            <Modal.Footer>
              <Button id="close" slot="close">
                Got it
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ModalExit />
    </div>
  );
}
