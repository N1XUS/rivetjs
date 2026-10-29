// Rivet-authored NativeSelect demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Label } from "@rivetjs/ui/label";
import { NativeSelect } from "@rivetjs/ui/native-select";

export const head = { title: "NativeSelect: Form Example" };

// #region demo
export function FormExample() {
  const sent = signal("");
  return (
    <Form
      class="flex w-72 flex-col gap-4"
      onSubmit={(e: SubmitEvent) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget as HTMLFormElement);
        sent.set(`${data.get("size")} / ${data.get("color")}`);
      }}
    >
      <NativeSelect name="size" isRequired>
        <Label>Size</Label>
        <NativeSelect.Trigger>
          <NativeSelect.Option value="">Choose a size</NativeSelect.Option>
          <NativeSelect.Option value="s">Small</NativeSelect.Option>
          <NativeSelect.Option value="m">Medium</NativeSelect.Option>
          <NativeSelect.Option value="l">Large</NativeSelect.Option>
        </NativeSelect.Trigger>
        <FieldError />
      </NativeSelect>
      <NativeSelect name="color" defaultValue="sand">
        <Label>Color</Label>
        <NativeSelect.Trigger>
          <NativeSelect.Option value="sand">Sand</NativeSelect.Option>
          <NativeSelect.Option value="olive">Olive</NativeSelect.Option>
          <NativeSelect.Option value="navy">Navy</NativeSelect.Option>
        </NativeSelect.Trigger>
      </NativeSelect>
      <Button type="submit">Add to cart</Button>
      <p class="text-sm text-muted">
        Submitted: <span id="sent">{sent() || "nothing yet"}</span>
      </p>
    </Form>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FormExample />
    </div>
  );
}
