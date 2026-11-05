import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/ui/button";
import { Card } from "@rivetjs/ui/card";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { Modal } from "@rivetjs/ui/modal";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "Settings" };

export default function Settings() {
  const name = signal("");
  const saved = signal("");
  const confirming = signal(false);
  const deleted = signal(false);
  return (
    <main class="mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-6">
      <h1 class="text-xl font-semibold">Settings</h1>
      <Card>
        <Card.Content class="flex flex-col gap-4">
          <TextField name="displayName" value={name}>
            <Label>Display name</Label>
            <Input id="display-name" />
          </TextField>
          <Button id="save" class="self-start" onPress={() => saved.set(name().trim())}>
            Save
          </Button>
          <Show when={saved()}>
            <p id="saved">Saved {saved()}</p>
          </Show>
        </Card.Content>
      </Card>
      <Button id="delete" variant="danger" class="self-start" onPress={() => confirming.set(true)}>
        Delete account
      </Button>
      <Show when={deleted()}>
        <p id="status">Account deleted</p>
      </Show>
      <Modal.Content isOpen={confirming}>
        <Modal.Header>Delete account?</Modal.Header>
        <Modal.Body>This cannot be undone.</Modal.Body>
        <Modal.Footer>
          <Button id="cancel" slot="close" variant="secondary">
            Cancel
          </Button>
          <Button
            id="confirm"
            variant="danger"
            onPress={() => {
              deleted.set(true);
              confirming.set(false);
            }}
          >
            Delete
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </main>
  );
}
