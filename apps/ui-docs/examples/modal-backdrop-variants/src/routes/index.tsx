// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/modal/backdrop-variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Rocket } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";

export const head = { title: "Modal: Backdrop Variants" };

// #region demo
export function BackdropVariants() {
  const variants = ["opaque", "blur", "transparent"] as const;

  return (
    <div class="flex flex-wrap gap-4">
      {variants.map((variant) => (
        <Modal>
          <Button variant="secondary">{variant.charAt(0).toUpperCase() + variant.slice(1)}</Button>
          <Modal.Content backdrop={variant} class="sm:max-w-[360px]">
            <Modal.Header>
              <Modal.Icon class="bg-default text-foreground">
                <Icon icon={Rocket} class="size-5" />
              </Modal.Icon>
              <Modal.Heading>Backdrop: {variant.charAt(0).toUpperCase() + variant.slice(1)}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p>
                This modal uses the <code>{variant}</code> backdrop variant. Compare the different visual effects: opaque provides full opacity, blur adds a
                backdrop filter, and transparent removes the background.
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
      <BackdropVariants />
    </div>
  );
}
