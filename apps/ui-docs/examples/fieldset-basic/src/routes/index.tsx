// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/fieldset/basic.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Icon } from "@rivetjs/kit/icon";
import { Save } from "lucide";
import { Button } from "@rivetjs/ui/button";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { FieldGroup, Fieldset } from "@rivetjs/ui/fieldset";
import { Form } from "@rivetjs/ui/form";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { TextArea } from "@rivetjs/ui/textarea";
import { TextField } from "@rivetjs/ui/textfield";

export const head = { title: "Fieldset: Usage" };

// #region demo
export function Basic() {
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
    <Form class="w-full max-w-96" onSubmit={onSubmit}>
      <Fieldset>
        <Fieldset.Legend>Profile Settings</Fieldset.Legend>
        <Description>Update your profile information.</Description>
        <FieldGroup>
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
            <Input placeholder="John Doe" />
            <FieldError />
          </TextField>
          <TextField isRequired name="email" type="email">
            <Label>Email</Label>
            <Input placeholder="john@example.com" />
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
            <TextArea placeholder="Tell us about yourself..." />
            <Description>Minimum 10 characters</Description>
            <FieldError />
          </TextField>
        </FieldGroup>
        <Fieldset.Actions>
          <Button type="submit">
            <Icon icon={Save} size={16} />
            Save changes
          </Button>
          <Button type="reset" variant="secondary">
            Cancel
          </Button>
        </Fieldset.Actions>
      </Fieldset>
    </Form>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Basic />
    </div>
  );
}
