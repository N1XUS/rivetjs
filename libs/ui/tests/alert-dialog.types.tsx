// Type-level suite (`tsc -p libs/ui` only): `AlertDialog` parts accept the cdk props (+ `class`), `AlertDialog["…Props"]`, Dialog
// render-function children, generic `AlertDialog.Icon<"span">`; errors: unknown status / size / placement.
import { AlertDialog } from "../src/components/alert-dialog/index.ts";

export const ok = () => (
  <AlertDialog onOpenChange={(o: boolean) => void o}>
    <AlertDialog.Trigger aria-label="x">t</AlertDialog.Trigger>
    <AlertDialog.Backdrop variant="transparent" isDismissable isKeyboardDismissDisabled={false} class="b">
      <AlertDialog.Container placement="bottom" size="cover" class="c">
        <AlertDialog.Dialog class="d">
          {({ close }) => (
            <>
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="accent" />
                <AlertDialog.Heading>T</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>b</AlertDialog.Body>
              <AlertDialog.Footer>
                <button onClick={() => close()}>x</button>
              </AlertDialog.Footer>
            </>
          )}
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  </AlertDialog>
);

export const generic = () => <AlertDialog.Icon<"span"> status="success" class="x" />;

const props: AlertDialog["ContainerProps"] = { size: "xs", placement: "center" };
void props;

// @ts-expect-error unknown status
export const badStatus = () => <AlertDialog.Icon status="info" />;

// @ts-expect-error unknown size (alert dialogs have no "full")
export const badSize = () => <AlertDialog.Container size="full">x</AlertDialog.Container>;

// @ts-expect-error unknown placement
export const badPlacement = () => <AlertDialog.Container placement="left">x</AlertDialog.Container>;
