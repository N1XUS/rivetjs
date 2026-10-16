// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/drawer/backdrop-variants.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Drawer } from "@rivetjs/ui/drawer";

export const head = { title: "Drawer: Backdrop Variants" };

// #region demo
export function BackdropVariants() {
  const variants = ["opaque", "blur", "transparent"] as const;

  return (
    <div class="flex flex-wrap gap-4">
      {variants.map((variant) => (
        <Drawer>
          <Button variant="secondary">{variant.charAt(0).toUpperCase() + variant.slice(1)}</Button>
          <Drawer.Content backdrop={variant}>
            <Drawer.Handle />
            <Drawer.Header>
              <Drawer.Heading>Backdrop: {variant.charAt(0).toUpperCase() + variant.slice(1)}</Drawer.Heading>
            </Drawer.Header>
            <Drawer.Body>
              <p>
                This drawer uses the <code>{variant}</code> backdrop variant.
              </p>
            </Drawer.Body>
            <Drawer.Footer>
              <Button class="w-full" slot="close">
                Close
              </Button>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer>
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
