import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { TextArea } from "@rivetjs/cdk/text-area";
import { TextField, autosizeProps } from "@rivetjs/cdk/text-field";

export const head = { title: "Auto-growing TextArea" };

// Angular CDK cdkTextareaAutosize, zero-JS path: `class` + `rows=1`; the min / max rows are CSS variables (styles.css).
const grow = autosizeProps({ native: true });

// #region demo
export default function Comment() {
  return (
    <TextField id="grow" class="m-4 grid max-w-sm gap-1 text-sm">
      <Label class="font-medium">Comment</Label>
      {/* `field-sizing: content` (text-field.css) between --cdk-autosize-min-rows and --cdk-autosize-max-rows. */}
      <TextArea rows={grow.rows} class={grow.class + " rounded-md border border-slate-300 px-3 py-2"} />
      <Text slot="description" class="text-xs text-slate-500">
        Grows from 2 to 6 lines.
      </Text>
    </TextField>
  );
}
// #endregion
