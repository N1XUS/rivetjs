import { FieldError } from "@rivetjs/cdk/form";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "TextField with plain CSS" };

// #region demo
export default function CssFields() {
  return (
    <div class="demo">
      <TextField id="css-name">
        <Label>Full name</Label>
        <Input />
        <Text slot="description">First and last name.</Text>
      </TextField>
      <TextField id="css-zip" defaultValue="12" isInvalid>
        <Label>Postcode</Label>
        <Input />
        <FieldError>Enter 5 digits.</FieldError>
      </TextField>
      <TextField id="css-ro" defaultValue="Fixed value" isReadOnly>
        <Label>Read-only</Label>
        <Input />
      </TextField>
    </div>
  );
}
// #endregion
