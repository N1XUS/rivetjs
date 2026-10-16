import { Button } from "@rivetjs/cdk/button";
import { FieldError, Form } from "@rivetjs/cdk/form";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "Form with plain CSS" };

// #region demo
export default function CssForm() {
  return (
    <Form id="css-form" validationErrors={{ zip: "Unknown postcode." }} onSubmit={(event) => event.preventDefault()}>
      {() => (
        <>
          <TextField id="css-city" name="city" isRequired>
            <Label>City</Label>
            <Input />
            <FieldError />
          </TextField>
          <TextField id="css-zip" name="zip" defaultValue="00000">
            <Label>Postcode</Label>
            <Input />
            <FieldError />
          </TextField>
          <Button type="submit">Save address</Button>
        </>
      )}
    </Form>
  );
}
// #endregion
