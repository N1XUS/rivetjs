// Type-level suite (`tsc -p libs/ui` only): `Drawer` parts accept the cdk props (+ `class`), `Drawer["…Props"]`, `state` from
// `useOverlayState`, Dialog render-function children, generic `Drawer.Header<"section">`; errors: unknown placement / variant.
import { Drawer } from "../src/components/drawer/index.ts";
import { useOverlayState } from "../src/hooks/use-overlay-state.tsx";

export const ok = () => {
  const state = useOverlayState({ defaultOpen: false, onOpenChange: (o: boolean) => void o });
  return (
    <Drawer state={state}>
      <Drawer.Trigger class="t" onPress={() => {}}>
        t
      </Drawer.Trigger>
      <Drawer.Backdrop variant="blur" isDismissable={false} isKeyboardDismissDisabled class="b">
        <Drawer.Container placement="left" class="c">
          <Drawer.Dialog class="d">
            {({ close }) => (
              <>
                <Drawer.Handle />
                <Drawer.CloseTrigger />
                <Drawer.Header>
                  <Drawer.Heading>T</Drawer.Heading>
                </Drawer.Header>
                <Drawer.Body>b</Drawer.Body>
                <Drawer.Footer>
                  <button onClick={() => close()}>x</button>
                </Drawer.Footer>
              </>
            )}
          </Drawer.Dialog>
        </Drawer.Container>
      </Drawer.Backdrop>
    </Drawer>
  );
};

export const generic = () => <Drawer.Header<"section"> class="x">t</Drawer.Header>;

const props: Drawer["ContentProps"] = { placement: "top" };
void props;

// @ts-expect-error unknown placement
export const badPlacement = () => <Drawer.Container placement="center">x</Drawer.Container>;

// @ts-expect-error unknown backdrop variant
export const badVariant = () => <Drawer.Backdrop variant="dark">x</Drawer.Backdrop>;
