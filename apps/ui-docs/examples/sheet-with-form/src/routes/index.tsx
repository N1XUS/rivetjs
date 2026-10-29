// Rivet-authored Sheet demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Sheet } from "@rivetjs/ui/sheet";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "Sheet: With Form" };

// #region demo
export function WithForm() {
  const name = signal("Studio Juniper");
  const saved = signal("Studio Juniper");
  return (
    <div class="flex flex-col items-center gap-3">
      <Sheet>
        <Button variant="secondary">Edit workspace</Button>
        <Sheet.Backdrop>
          <Sheet.Content>
            <Sheet.Dialog>
              <Sheet.Handle />
              <Sheet.Header>
                <Sheet.Heading>Workspace</Sheet.Heading>
              </Sheet.Header>
              <Sheet.Body>
                <TextField value={name} class="w-full">
                  <Label>Workspace name</Label>
                  <Input id="sheet-form-name" />
                </TextField>
              </Sheet.Body>
              <Sheet.Footer>
                <Button slot="close" variant="secondary">
                  Cancel
                </Button>
                <Button slot="close" id="sheet-form-save" onPress={() => saved.set(name())}>
                  Save
                </Button>
              </Sheet.Footer>
            </Sheet.Dialog>
          </Sheet.Content>
        </Sheet.Backdrop>
      </Sheet>
      <p class="text-sm text-muted">
        Saved: <span id="sheet-form-saved">{saved()}</span>
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <WithForm />
    </div>
  );
}
