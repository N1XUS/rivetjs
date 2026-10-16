// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/modal/with-form.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Mail } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { Modal } from "@rivetjs/ui/modal";
import { Surface } from "@rivetjs/ui/surface";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "Modal: With Form" };

// #region demo
export function WithForm() {
  return (
    <Modal>
      <Button variant="secondary">Open Contact Form</Button>
      <Modal.Content placement="auto" class="sm:max-w-md">
        <Modal.Header>
          <Modal.Icon class="bg-accent-soft text-accent-soft-foreground">
            <Icon icon={Mail} class="size-5" />
          </Modal.Icon>
          <Modal.Heading>Contact Us</Modal.Heading>
          <p class="mt-1.5 text-sm leading-5 text-muted">
            Fill out the form below and we'll get back to you. The modal adapts automatically when the keyboard appears on mobile.
          </p>
        </Modal.Header>
        <Modal.Body class="p-6">
          <Surface variant="default">
            <form class="flex flex-col gap-4">
              <TextField class="w-full" name="name" type="text" variant="secondary">
                <Label>Name</Label>
                <Input placeholder="Enter your name" />
              </TextField>
              <TextField class="w-full" name="email" type="email" variant="secondary">
                <Label>Email</Label>
                <Input placeholder="Enter your email" />
              </TextField>
              <TextField class="w-full" name="phone" type="tel" variant="secondary">
                <Label>Phone</Label>
                <Input placeholder="Enter your phone number" />
              </TextField>
              <TextField class="w-full" name="company" variant="secondary">
                <Label>Company</Label>
                <Input placeholder="Enter your company name" />
              </TextField>
              <TextField class="w-full" name="message" variant="secondary">
                <Label>Message</Label>
                <Input placeholder="Enter your message" />
              </TextField>
            </form>
          </Surface>
        </Modal.Body>
        <Modal.Footer>
          <Button slot="close" variant="secondary">
            Cancel
          </Button>
          <Button slot="close">Send Message</Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
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
