// AlertDialog on a resumed page (upstream alert-dialog fixture + browser test): `#ad-trigger` Button opens `#ad-dialog` (close
// trigger, danger icon, heading, footer Cancel `#ad-cancel` / Delete `#ad-delete` slot=close); `#ad-dtrigger` `AlertDialog.Trigger`
// opens `#ad-ddialog` (`isDismissable`, `isKeyboardDismissDisabled={false}`, size sm, status success).
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Button } from "@rivetjs/ui/button";

export default function AlertDialogStories() {
  return (
    <section class="flex flex-wrap gap-8 p-10">
      <AlertDialog>
        <Button id="ad-trigger">Delete Project</Button>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog id="ad-dialog">
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>Delete project permanently?</AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>This action cannot be undone.</p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button id="ad-cancel" slot="close" variant="tertiary">
                  Cancel
                </Button>
                <Button id="ad-delete" slot="close" variant="danger">
                  Delete Project
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>

      <AlertDialog>
        <AlertDialog.Trigger id="ad-dtrigger">Dismissable</AlertDialog.Trigger>
        <AlertDialog.Backdrop isDismissable isKeyboardDismissDisabled={false}>
          <AlertDialog.Container size="sm">
            <AlertDialog.Dialog id="ad-ddialog">
              <AlertDialog.Header>
                <AlertDialog.Icon status="success" />
                <AlertDialog.Heading>Saved</AlertDialog.Heading>
              </AlertDialog.Header>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    </section>
  );
}
