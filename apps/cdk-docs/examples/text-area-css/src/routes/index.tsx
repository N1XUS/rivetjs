import { FieldError } from "@rivetjs/cdk/form";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { TextArea } from "@rivetjs/cdk/text-area";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "TextArea with plain CSS" };

// #region demo
export default function CssAreas() {
  return (
    <div class="demo">
      <TextField id="css-ta">
        <Label>Message</Label>
        <TextArea rows={3} />
        <Text slot="description">Plain text only.</Text>
      </TextField>
      <TextField id="css-ta-bad" isInvalid defaultValue={"a\nb\nc"}>
        <Label>Signature</Label>
        <TextArea rows={2} />
        <FieldError>Too many lines.</FieldError>
      </TextField>
    </div>
  );
}
// #endregion
