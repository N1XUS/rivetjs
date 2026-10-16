import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { FieldError, Form } from "@rivetjs/cdk/form";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "Form validationBehavior" };

const input = "rounded-md border border-slate-300 px-3 py-1.5 data-[invalid]:border-red-600";

// #region demo
export default function Behaviours() {
  const log = signal("");
  return (
    <section class="m-4 grid max-w-sm gap-6 text-sm">
      {/* native (default): the browser's constraint validation blocks the submit. */}
      <Form id="native-form" onSubmit={(event) => event.preventDefault()}>
        {() => (
          <div class="grid gap-2">
            <TextField id="native-email" name="email" type="email" isRequired class="grid gap-1">
              <Label>Email (native)</Label>
              <Input class={input} />
              <FieldError class="text-xs text-red-700" />
            </TextField>
            <Button id="native-submit" type="submit" class="justify-self-start rounded-md border border-slate-300 px-3 py-1">
              Submit
            </Button>
          </div>
        )}
      </Form>
      {/* aria: realtime aria-invalid, submit never blocked (validate on the server). */}
      <Form
        id="aria-form"
        validationBehavior="aria"
        onSubmit={(event) => {
          event.preventDefault();
          log.set("aria form submitted");
        }}
      >
        {() => (
          <div class="grid gap-2">
            <TextField id="aria-email" name="email" type="email" isRequired class="grid gap-1">
              <Label>Email (aria)</Label>
              <Input class={input} />
              <FieldError class="text-xs text-red-700" />
            </TextField>
            <Button id="aria-submit" type="submit" class="justify-self-start rounded-md border border-slate-300 px-3 py-1">
              Submit
            </Button>
          </div>
        )}
      </Form>
      <output id="fv-log">{log()}</output>
    </section>
  );
}
// #endregion
