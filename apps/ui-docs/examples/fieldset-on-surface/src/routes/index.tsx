// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/fieldset/on-surface.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Save } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Fieldset } from "@rivetjs/ui/fieldset";
import { Form } from "@rivetjs/ui/form";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { Surface } from "@rivetjs/ui/surface";
import { TextArea } from "@rivetjs/ui/textarea";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "Fieldset: In Surface" };

// #region demo
export function OnSurface() {
  const onSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const data: Record<string, string> = {};

    // Convert FormData to plain object
    formData.forEach((value, key) => {
      data[key] = value.toString();
    });

    alert("Form submitted successfully!");
  };

  return (
    <div class="flex items-center justify-center rounded-3xl bg-surface p-6">
      <Surface class="w-full min-w-[380px]">
        <Form onSubmit={onSubmit}>
          <Fieldset class="w-full">
            <Fieldset.Legend>Profile Settings</Fieldset.Legend>
            <Description>Update your profile information.</Description>
            <Fieldset.Group>
              <TextField
                isRequired
                name="name"
                validate={(value) => {
                  if (value.length < 3) {
                    return "Name must be at least 3 characters";
                  }

                  return null;
                }}
              >
                <Label>Name</Label>
                <Input placeholder="John Doe" variant="secondary" />
                <FieldError />
              </TextField>
              <TextField isRequired name="email" type="email">
                <Label>Email</Label>
                <Input placeholder="john@example.com" variant="secondary" />
                <FieldError />
              </TextField>
              <TextField
                isRequired
                name="bio"
                validate={(value) => {
                  if (value.length < 10) {
                    return "Bio must be at least 10 characters";
                  }

                  return null;
                }}
              >
                <Label>Bio</Label>
                <TextArea placeholder="Tell us about yourself..." variant="secondary" />
                <Description>Minimum 10 characters</Description>
                <FieldError />
              </TextField>
            </Fieldset.Group>
            <Fieldset.Actions>
              <Button type="submit">
                <Icon icon={Save} size={16} />
                Save changes
              </Button>
              <Button type="reset" variant="tertiary">
                Cancel
              </Button>
            </Fieldset.Actions>
          </Fieldset>
        </Form>
      </Surface>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <OnSurface />
    </div>
  );
}
