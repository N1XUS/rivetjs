// ui page-CSS fixture: Button + TextField + Modal (spec §3.4 target: ≤ 40 KB minified CSS).
import { Button } from "@rivetjs/ui/button";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { Modal } from "@rivetjs/ui/modal";
import { TextField } from "@rivetjs/ui/textfield";

export default function Page() {
  return (
    <main>
      <TextField name="email">
        <Label>Email</Label>
        <Input placeholder="you@example.com" />
      </TextField>
      <Modal>
        <Button>Open</Button>
        <Modal.Backdrop>
          <Modal.Container>
            <Modal.Dialog>
              <Modal.Header>
                <Modal.Heading>Welcome</Modal.Heading>
              </Modal.Header>
              <Modal.Body>Body</Modal.Body>
              <Modal.Footer>
                <Button slot="close">Continue</Button>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </main>
  );
}
