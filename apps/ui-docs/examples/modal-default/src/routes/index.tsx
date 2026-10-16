// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/modal/default.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Rocket } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";

export const head = { title: "Modal: Usage" };

// #region demo
export function Default() {
  return (
    <Modal>
      <Button variant="secondary">Open Modal</Button>
      <Modal.Content class="sm:max-w-[360px]">
        <Modal.Header>
          <Modal.Icon class="bg-default text-foreground">
            <Icon icon={Rocket} class="size-5" />
          </Modal.Icon>
          <Modal.Heading>Welcome to Rivet UI</Modal.Heading>
        </Modal.Header>
        <Modal.Body>
          <p>A beautiful, fast, and modern React UI library for building accessible and customizable web applications with ease.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button class="w-full" slot="close">
            Continue
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Default />
    </div>
  );
}
