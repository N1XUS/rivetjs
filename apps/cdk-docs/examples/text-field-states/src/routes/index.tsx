import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "Disabled, read-only and labelled TextFields" };

const field = "group grid gap-1";
const input = "rounded-md border border-slate-300 px-3 py-1.5 disabled:bg-slate-100 disabled:text-slate-400 read-only:bg-slate-50";

// #region demo
export default function States() {
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <TextField id="tf-off" defaultValue="Can't touch this" isDisabled class={field}>
        <Label class="group-data-[disabled]:text-slate-400">Disabled</Label>
        <Input class={input} />
      </TextField>
      <TextField id="tf-ro" defaultValue="INV-2041" isReadOnly class={field}>
        <Label>Read-only</Label>
        <Input class={input} />
      </TextField>
      <TextField id="tf-req" isRequired class={field}>
        <Label>Required</Label>
        <Input class={input} />
      </TextField>
      {/* No visible label: name the field yourself. */}
      <TextField id="tf-search2" aria-label="Search the docs" type="search" class={field}>
        <Input class={input} placeholder="Search…" />
      </TextField>
      <span id="qty-label">Quantity</span>
      <TextField id="tf-qty" aria-labelledby="qty-label" inputMode="numeric" class={field}>
        <Input class={input} />
      </TextField>
    </section>
  );
}
// #endregion
