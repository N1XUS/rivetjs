// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/alert-dialog/backdrop-variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "AlertDialog: Backdrop Variants" };

// #region demo
export function BackdropVariants() {
  const variants = ["opaque", "blur", "transparent"] as const;

  return (
    <div class="flex flex-wrap gap-4">
      {variants.map((variant) => (
        <AlertDialog>
          <Button variant="secondary">{variant.charAt(0).toUpperCase() + variant.slice(1)}</Button>
          <AlertDialog.Backdrop variant={variant}>
            <AlertDialog.Container>
              <AlertDialog.Dialog class="sm:max-w-[400px]">
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon status="accent" />
                  <AlertDialog.Heading>Backdrop: {variant.charAt(0).toUpperCase() + variant.slice(1)}</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>
                    {variant === "opaque"
                      ? "An opaque dark backdrop that completely obscures the background, providing maximum focus on the dialog."
                      : variant === "blur"
                        ? "A blurred backdrop that softly obscures the background while maintaining visual context."
                        : "A transparent backdrop that keeps the background fully visible, useful for less critical confirmations."}
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
        </AlertDialog>
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
