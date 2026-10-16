// Rivet-authored Sheet demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Button } from "@rivetjs/ui/button";
import { Sheet } from "@rivetjs/ui/sheet";

export const head = { title: "Sheet: Backdrop Variants" };

// #region demo
const VARIANTS = ["opaque", "blur", "transparent"] as const;

export function BackdropVariants() {
  return (
    <div class="flex flex-wrap gap-3">
      {VARIANTS.map((variant) => (
        <Sheet>
          <Button variant="secondary" class="capitalize">
            {variant}
          </Button>
          <Sheet.Backdrop variant={variant}>
            <Sheet.Content>
              <Sheet.Dialog>
                <Sheet.Handle />
                <Sheet.Header>
                  <Sheet.Heading>Backdrop: {variant}</Sheet.Heading>
                </Sheet.Header>
                <Sheet.Body>
                  <p class="text-sm text-muted">The backdrop sits between the page and the sheet; pressing it closes the sheet.</p>
                </Sheet.Body>
              </Sheet.Dialog>
            </Sheet.Content>
          </Sheet.Backdrop>
        </Sheet>
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
