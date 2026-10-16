// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/drawer/with-form.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Drawer } from "@rivetjs/ui/drawer";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "Drawer: With Form" };

// #region demo
export function WithForm() {
  return (
    <Drawer placement="right">
      <Button variant="secondary">Edit Profile</Button>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Heading>Edit Profile</Drawer.Heading>
        </Drawer.Header>
        <Drawer.Body>
          <form class="flex flex-col gap-4">
            <TextField class="w-full" name="name" type="text">
              <Label>Name</Label>
              <Input placeholder="Enter your name" variant="secondary" />
            </TextField>
            <TextField class="w-full" name="email" type="email">
              <Label>Email</Label>
              <Input placeholder="Enter your email" variant="secondary" />
            </TextField>
            <TextField class="w-full" name="bio">
              <Label>Bio</Label>
              <Input placeholder="Tell us about yourself" variant="secondary" />
            </TextField>
          </form>
        </Drawer.Body>
        <Drawer.Footer>
          <Button slot="close" variant="secondary">
            Cancel
          </Button>
          <Button slot="close">Save Changes</Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
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
