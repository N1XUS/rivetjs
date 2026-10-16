// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/checkbox-group/validation.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { CheckboxGroup } from "@rivetjs/ui/checkbox-group";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Label } from "@rivetjs/ui/label";

export const head = { title: "CheckboxGroup: Validation" };

// #region demo
export function Validation() {
  return (
    <Form
      class="flex flex-col gap-4 px-4"
      onSubmit={(e) => {
        e.preventDefault();

        const formData = new FormData(e.currentTarget as HTMLFormElement);
        const values = formData.getAll("preferences");

        alert(`Selected preferences: ${values.join(", ")}`);
      }}
    >
      <CheckboxGroup isRequired name="preferences">
        <Label>Preferences</Label>
        <Checkbox value="email">
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Email notifications
          </Checkbox.Content>
        </Checkbox>
        <Checkbox value="sms">
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            SMS notifications
          </Checkbox.Content>
        </Checkbox>
        <Checkbox value="push">
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Push notifications
          </Checkbox.Content>
        </Checkbox>
        <FieldError>Please select at least one notification method.</FieldError>
      </CheckboxGroup>
      <Button type="submit">Submit</Button>
    </Form>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <Validation />
    </div>
  );
}
