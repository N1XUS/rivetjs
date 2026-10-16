import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { TextArea } from "@rivetjs/cdk/text-area";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "TextArea with Tailwind" };

// #region demo
const field = "group grid gap-1 text-sm";
// The TextArea part's state attributes: data-hovered, data-focused (cdk `focused:` variant), data-focus-visible, data-invalid.
const area =
  "min-h-16 resize-y rounded-md border border-slate-300 px-3 py-2 outline-none data-[hovered]:border-slate-400 " +
  "focused:border-teal-600 data-[focus-visible]:ring-2 data-[focus-visible]:ring-teal-500/30 data-[invalid]:border-red-600 group-data-[readonly]:bg-slate-50";

export default function TailwindAreas() {
  return (
    <section class="m-4 grid max-w-sm gap-4">
      <TextField id="tw-ta" class={field}>
        <Label class="font-medium text-slate-700">Review</Label>
        <TextArea class={area} />
        <Text slot="description" class="text-xs text-slate-500">
          Markdown is fine.
        </Text>
      </TextField>
      <TextField id="tw-ta-ro" defaultValue="Be kind." isReadOnly class={field}>
        <Label class="font-medium text-slate-700">Terms</Label>
        <TextArea class={area} />
      </TextField>
    </section>
  );
}
// #endregion
