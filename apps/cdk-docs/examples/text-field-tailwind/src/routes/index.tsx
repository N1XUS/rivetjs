import { FieldError } from "@rivetjs/cdk/form";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "TextField with Tailwind" };

// #region demo
const field = "group grid gap-1 text-sm";
const label = "font-medium text-slate-700 group-data-[disabled]:text-slate-400";
// The Input part's state attributes: data-hovered, data-focused (cdk `focused:` variant), data-focus-visible, data-invalid, data-disabled.
const input =
  "rounded-md border border-slate-300 px-3 py-1.5 outline-none transition placeholder:text-slate-400 " +
  "data-[hovered]:border-slate-400 focused:border-teal-600 data-[focus-visible]:ring-2 data-[focus-visible]:ring-teal-500/30 " +
  "data-[invalid]:border-red-600 data-[disabled]:bg-slate-100";

export default function TailwindFields() {
  return (
    <section class="m-4 grid max-w-sm gap-4">
      <TextField id="tw-email" type="email" class={field}>
        <Label class={label}>Email</Label>
        <Input class={input} placeholder="you@example.com" />
        <Text slot="description" class="text-xs text-slate-500">
          We never share it.
        </Text>
      </TextField>
      <TextField id="tw-bad" defaultValue="XYZ" isInvalid class={field}>
        <Label class={label}>Code</Label>
        <Input class={input} />
        <FieldError class="text-xs text-red-700">Not a valid code.</FieldError>
      </TextField>
      <TextField id="tw-off" isDisabled class={field}>
        <Label class={label}>Disabled</Label>
        <Input class={input} />
      </TextField>
    </section>
  );
}
// #endregion
