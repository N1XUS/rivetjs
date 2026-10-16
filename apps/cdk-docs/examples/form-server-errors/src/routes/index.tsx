import { Button } from "@rivetjs/cdk/button";
import { FieldError, Form, type ValidationErrors } from "@rivetjs/cdk/form";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { RadioGroup } from "@rivetjs/cdk/radio-group";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "Form server errors" };

// Errors keyed by field name, e.g. from the action that handled the last submit.
const errors: ValidationErrors = {
  username: "That username is taken.",
  plan: "Pick a paid plan for teams.",
};

const input = "rounded-md border border-slate-300 px-3 py-1.5 data-[invalid]:border-red-600";

// #region demo
export default function Team() {
  return (
    <Form class="m-4 grid max-w-sm gap-3 text-sm" validationErrors={errors} onSubmit={(event) => event.preventDefault()}>
      {/* Function child: the fields read the Form's server errors by their name. */}
      {() => (
        <>
          <TextField id="se-user" name="username" defaultValue="ada" class="grid gap-1">
            <Label>Username</Label>
            <Input class={input} />
            <FieldError class="text-xs text-red-700" />
          </TextField>
          <TextField id="se-email" name="email" defaultValue="ada@example.com" class="grid gap-1">
            <Label>Email</Label>
            <Input class={input} />
            <FieldError class="text-xs text-red-700" />
          </TextField>
          <RadioGroup
            id="se-plan"
            name="plan"
            label="Plan"
            defaultValue="free"
            items={[
              { value: "free", label: "Free" },
              { value: "team", label: "Team" },
            ]}
          />
          <Button type="submit" class="justify-self-start rounded-md bg-teal-700 px-3 py-1.5 text-white">
            Create team
          </Button>
        </>
      )}
    </Form>
  );
}
// #endregion
