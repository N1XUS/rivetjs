import { Button } from "@rivetjs/cdk/button";
import { FieldError, Form } from "@rivetjs/cdk/form";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "Form with Tailwind" };

// #region demo
const field = "group grid gap-1";
const label = "text-sm font-medium";
const input = "rounded-md border border-slate-300 px-3 py-1.5 text-sm user-invalid:border-red-600 group-data-[invalid]:border-red-600";
const error = "text-xs text-red-700";

export default function TailwindForm() {
  return (
    <Form
      id="tw-form"
      class="m-4 grid max-w-sm gap-4 rounded-xl border border-slate-200 p-4 has-[[data-invalid]]:border-red-300"
      validationErrors={{ slug: "Slug already in use." }}
      onSubmit={(event) => event.preventDefault()}
    >
      {() => (
        <>
          <TextField id="tw-title" name="title" isRequired class={field}>
            <Label class={label}>Title</Label>
            <Input class={input} />
            <FieldError class={error} />
          </TextField>
          <TextField id="tw-slug" name="slug" defaultValue="launch" class={field}>
            <Label class={label}>Slug</Label>
            <Input class={input} />
            <FieldError class={error} />
          </TextField>
          <Button type="submit" class="justify-self-start rounded-md bg-teal-700 px-3 py-1.5 text-sm text-white">
            Publish
          </Button>
        </>
      )}
    </Form>
  );
}
// #endregion
