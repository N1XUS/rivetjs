// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/alert-dialog/sizes.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Rocket } from "lucide";
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "AlertDialog: Sizes" };

// #region demo
export function Sizes() {
  const sizes = ["xs", "sm", "md", "lg", "cover"] as const;

  return (
    <div class="flex flex-wrap gap-4">
      {sizes.map((size) => (
        <AlertDialog>
          <Button variant="secondary">{size.charAt(0).toUpperCase() + size.slice(1)}</Button>
          <AlertDialog.Backdrop>
            <AlertDialog.Container size={size}>
              <AlertDialog.Dialog>
                <AlertDialog.CloseTrigger />
                <AlertDialog.Header>
                  <AlertDialog.Icon class="bg-default text-foreground">
                    <Icon icon={Rocket} class="size-5" />
                  </AlertDialog.Icon>
                  <AlertDialog.Heading>Size: {size.charAt(0).toUpperCase() + size.slice(1)}</AlertDialog.Heading>
                </AlertDialog.Header>
                <AlertDialog.Body>
                  <p>
                    {size === "cover" ? (
                      <>
                        This alert dialog uses the <code>cover</code> size variant. It spans the full screen with margins: 16px on mobile and 40px on desktop.
                        Maintains rounded corners and standard padding. Perfect for critical confirmations that need maximum width while preserving alert dialog
                        aesthetics.
                      </>
                    ) : (
                      <>
                        This alert dialog uses the <code>{size}</code> size variant. On mobile devices, all sizes adapt to near full-width for optimal viewing.
                        On desktop, each size provides a different maximum width to suit various content needs.
                      </>
                    )}
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
      <Sizes />
    </div>
  );
}
