// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/fieldset/custom-styles.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
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

export const head = { title: "Fieldset: Tailwind CSS" };

// #region demo
const shell =
  "rounded-xl border border-border/70 bg-linear-to-b from-neutral-50/90 to-white p-4 ring-1 ring-black/5 dark:from-neutral-900/80 dark:to-neutral-900 dark:ring-white/10";

const field =
  "rounded-xl border border-border/80 bg-surface shadow-sm ring-1 ring-black/5 transition-[box-shadow,border-color] focus-visible:ring-2 focus-visible:ring-neutral-400/25 dark:ring-white/10 dark:focus-visible:ring-neutral-500/30";

export function CustomStyles() {
  const onSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    alert("Form submitted successfully!");
  };

  return (
    <Form class="w-full max-w-96" onSubmit={onSubmit}>
      <Fieldset class={shell}>
        <Fieldset.Legend class="font-medium text-neutral-800 dark:text-neutral-100">Profile Settings</Fieldset.Legend>
        <Description class="text-neutral-600 dark:text-neutral-400">Update your profile information.</Description>
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
            <Input class={field} placeholder="John Doe" />
            <FieldError />
          </TextField>
          <TextField isRequired name="email" type="email">
            <Label>Email</Label>
            <Input class={field} placeholder="john@example.com" />
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
            <TextArea class={field} placeholder="Tell us about yourself..." />
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
      <CustomStyles />
    </div>
  );
}
