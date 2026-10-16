// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/modal/sizes.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Rocket } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Modal } from "@rivetjs/ui/modal";

export const head = { title: "Modal: Sizes" };

// #region demo
export function Sizes() {
  const sizes = ["xs", "sm", "md", "lg", "cover", "full"] as const;

  return (
    <div class="flex flex-wrap gap-4">
      {sizes.map((size) => (
        <Modal>
          <Button variant="secondary">{size.charAt(0).toUpperCase() + size.slice(1)}</Button>
          <Modal.Content size={size}>
            <Modal.Header>
              <Modal.Icon class="bg-default text-foreground">
                <Icon icon={Rocket} class="size-5" />
              </Modal.Icon>
              <Modal.Heading>Size: {size.charAt(0).toUpperCase() + size.slice(1)}</Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <p>
                {size === "cover" ? (
                  <>
                    This modal uses the <code>cover</code> size variant. It spans the full screen with margins: 16px on mobile and 40px on desktop. Maintains
                    rounded corners and standard padding. Perfect for cover-style content that needs maximum width while preserving modal aesthetics.
                  </>
                ) : size === "full" ? (
                  <>
                    This modal uses the <code>full</code> size variant. It occupies the entire viewport without any margins, rounded corners, or shadows,
                    creating a true fullscreen experience. Ideal for immersive content or full-page interactions.
                  </>
                ) : (
                  <>
                    This modal uses the <code>{size}</code> size variant. On mobile devices, all sizes adapt to near full-width for optimal viewing. On desktop,
                    each size provides a different maximum width to suit various content needs.
                  </>
                )}
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button slot="close" variant="secondary">
                Cancel
              </Button>
              <Button slot="close">Confirm</Button>
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
      <Sizes />
    </div>
  );
}
