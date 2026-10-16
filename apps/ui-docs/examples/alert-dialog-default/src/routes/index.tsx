// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/alert-dialog/default.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { AlertDialog } from "@rivetjs/ui/alert-dialog";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "AlertDialog: Usage" };

// #region demo
export function Default() {
  return (
    <AlertDialog>
      <Button variant="danger">Delete Project</Button>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog class="sm:max-w-[400px]">
            <AlertDialog.CloseTrigger />
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>Delete project permanently?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p>
                This will permanently delete <strong>My Awesome Project</strong> and all of its data. This action cannot be undone.
              </p>
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button slot="close" variant="tertiary">
                Cancel
              </Button>
              <Button slot="close" variant="danger">
                Delete Project
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Default />
    </div>
  );
}
