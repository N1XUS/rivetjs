import { Button } from "@rivetjs/cdk/button";
import { FieldError, Form } from "@rivetjs/cdk/form";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "TextField validation" };

const field = "grid gap-1";
const input = "rounded-md border border-slate-300 px-3 py-1.5 data-[invalid]:border-red-600";
const error = "text-xs text-red-700";

// #region demo
export default function SignUp() {
  return (
    <Form class="m-4 grid max-w-sm gap-3 text-sm" validationErrors={{ username: "That username is taken." }} onSubmit={(event) => event.preventDefault()}>
      {() => (
        <>
          <TextField id="email" name="email" type="email" isRequired class={field}>
            <Label>Email</Label>
            <Input class={input} />
            {/* Render-prop children: a custom message per native validity state. */}
            <FieldError class={error}>
              {({ validationDetails, validationErrors }) => (validationDetails().valueMissing ? "Enter your email." : validationErrors().join(" "))}
            </FieldError>
          </TextField>
          <TextField id="user" name="username" defaultValue="ada" class={field}>
            <Label>Username</Label>
            <Input class={input} />
            <FieldError class={error} />
          </TextField>
          <TextField id="nick" name="nick" defaultValue="the count" validate={(value) => (/\s/.test(value) ? "No spaces." : null)} class={field}>
            <Label>Nickname</Label>
            <Input class={input} />
            <FieldError class={error} />
          </TextField>
          <TextField
            id="code"
            name="code"
            defaultValue="ab"
            isRequired
            validationBehavior="aria"
            validate={(value) => (value.length < 3 ? `At least 3 characters (you typed ${value.length}).` : null)}
            class={field}
          >
            <Label>Invite code</Label>
            <Input class={input} />
            <FieldError class={error} />
          </TextField>
          <Button id="signup" type="submit" class="justify-self-start rounded-md bg-teal-700 px-3 py-1.5 text-white">
            Sign up
          </Button>
        </>
      )}
    </Form>
  );
}
// #endregion
