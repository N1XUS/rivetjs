import { Button } from "@rivetjs/cdk/button";
import { FieldError, Form } from "@rivetjs/cdk/form";
import { Label } from "@rivetjs/cdk/label";
import { TextArea } from "@rivetjs/cdk/text-area";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "TextArea validation" };

const field = "grid gap-1";
const area = "rounded-md border border-slate-300 px-3 py-2 data-[invalid]:border-red-600";
const error = "text-xs text-red-700";

// #region demo
export default function Feedback() {
  return (
    <Form class="m-4 grid max-w-sm gap-3 text-sm" validationErrors={{ address: "We cannot deliver there." }} onSubmit={(event) => event.preventDefault()}>
      {() => (
        <>
          <TextField id="ta-why" name="why" isRequired minLength={10} class={field}>
            <Label>Why are you leaving?</Label>
            <TextArea rows={2} class={area} />
            <FieldError class={error} />
          </TextField>
          <TextField id="ta-address" name="address" defaultValue={"1 Infinite Loop\nAtlantis"} class={field}>
            <Label>Address</Label>
            <TextArea rows={2} class={area} />
            <FieldError class={error} />
          </TextField>
          <TextField
            id="ta-tweet"
            name="tweet"
            validationBehavior="aria"
            defaultValue="This post is twenty-five"
            validate={(value) => (value.length > 20 ? `Too long by ${value.length - 20}.` : null)}
            class={field}
          >
            <Label>Post</Label>
            <TextArea rows={2} class={area} />
            <FieldError class={error} />
          </TextField>
          <Button id="ta-send" type="submit" class="justify-self-start rounded-md bg-teal-700 px-3 py-1.5 text-white">
            Send
          </Button>
        </>
      )}
    </Form>
  );
}
// #endregion
