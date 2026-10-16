// Type-level suite (`tsc -p libs/ui` only): `Modal` parts accept the cdk props (+ `class`), `Modal["…Props"]`, `state` from
// `useOverlayState`, Dialog render-function children, generic `Modal.Header<"section">`; errors: unknown size / placement /
// variant.
import { Modal } from "../src/components/modal/index.ts";
import { useOverlayState } from "../src/hooks/use-overlay-state.tsx";

export const ok = () => {
  const state = useOverlayState({ defaultOpen: false, onOpenChange: (o: boolean) => void o });
  return (
    <Modal state={state}>
      <Modal.Trigger aria-label="x">t</Modal.Trigger>
      <Modal.Backdrop variant="blur" isDismissable={false} isKeyboardDismissDisabled class="b">
        <Modal.Container placement="center" scroll="outside" size="cover" class="c">
          <Modal.Dialog class="d">
            {({ close }) => (
              <>
                <Modal.CloseTrigger />
                <Modal.Header>
                  <Modal.Icon>i</Modal.Icon>
                  <Modal.Heading>T</Modal.Heading>
                </Modal.Header>
                <Modal.Body>b</Modal.Body>
                <Modal.Footer>
                  <button onClick={() => close()}>x</button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};

export const generic = () => <Modal.Header<"section"> class="x">t</Modal.Header>;

const props: Modal["ContainerProps"] = { size: "xs", placement: "bottom" };
void props;

// @ts-expect-error unknown size
export const badSize = () => <Modal.Container size="huge">x</Modal.Container>;

// @ts-expect-error unknown placement
export const badPlacement = () => <Modal.Container placement="left">x</Modal.Container>;

// @ts-expect-error unknown backdrop variant
export const badVariant = () => <Modal.Backdrop variant="dark">x</Modal.Backdrop>;
