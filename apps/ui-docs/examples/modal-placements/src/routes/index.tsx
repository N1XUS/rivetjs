// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/modal/placements.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Rocket } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";

export const head = { title: "Modal: Placement" };

// #region demo
export function Placements() {
  const placements = ["auto", "top", "center", "bottom"] as const;

  return (
    <div class="flex flex-wrap gap-4">
      {placements.map((placement) => (
        <Modal>
          <Button variant="secondary">{placement.charAt(0).toUpperCase() + placement.slice(1)}</Button>
          <Modal.Content placement={placement} class="sm:max-w-[360px]">
            <Modal.Header>
              <Modal.Icon class="bg-default text-foreground">
                <Icon icon={Rocket} class="size-5" />
              </Modal.Icon>
              <Modal.Heading>Placement: {placement.charAt(0).toUpperCase() + placement.slice(1)}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p>
                This modal uses the <code>{placement}</code> placement option. Try different placements to see how the modal positions itself on the screen.
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button class="w-full" slot="close">
                Continue
              </Button>
            </Modal.Footer>
          </Modal.Content>
        </Modal>
      ))}
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Placements />
    </div>
  );
}
