import { signal } from "@rivetjs/reactivity";
import { TextField } from "@rivetjs/cdk/text-field";
import { Form, FieldError } from "@rivetjs/cdk/form";
import { Label } from "@rivetjs/cdk/label";
import { Input } from "@rivetjs/cdk/input";
import { TextArea } from "@rivetjs/cdk/text-area";
import { Text } from "@rivetjs/cdk/text";

export const head = { title: "TextField" };

export default function TextFieldStory() {
  const name = signal("");
  const code = signal("");
  return (
    <section>
      <h1>TextField</h1>
      <Form id="tf-form" method="get" action="/text-field" validationErrors={{ username: "Username taken" }}>
        {() => (
          <>
            <TextField id="tf-name" name="name" value={name} isRequired>
              <Label>Name</Label>
              <Input />
              <Text slot="description">As on your passport</Text>
              <FieldError />
            </TextField>
            <TextField id="tf-user" name="username" defaultValue="ada">
              <Label>Username</Label>
              <Input />
              <FieldError />
            </TextField>
            <TextField id="tf-code" name="code" value={code} validate={(v) => (v.length && v.length < 3 ? "At least 3 characters" : null)}>
              <Label>Code</Label>
              <Input />
              <FieldError>
                {({ validationDetails, validationErrors }) => (validationDetails().valueMissing ? "Enter a code" : validationErrors().join(" "))}
              </FieldError>
            </TextField>
            <TextField id="tf-aria" name="aria" validationBehavior="aria" isRequired validate={(v) => (v === "bad" ? "No bad" : null)}>
              <Label>Aria</Label>
              <Input />
              <FieldError />
            </TextField>
            <TextField id="tf-bio" name="bio">
              <Label>Bio</Label>
              <TextArea rows={2} />
            </TextField>
            <button id="tf-submit" type="submit">
              Submit
            </button>
            <button id="tf-reset" type="reset">
              Reset
            </button>
          </>
        )}
      </Form>
      <p id="tf-value">
        name={name()} code={code()}
      </p>
    </section>
  );
}
