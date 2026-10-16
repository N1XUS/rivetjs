// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/color-field/form-example.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import type { Color } from "@rivetjs/cdk/color";
import { ColorField } from "@rivetjs/ui/color-field";
import { ColorSwatch } from "@rivetjs/ui/color-swatch";
import { Description } from "@rivetjs/ui/description";
import { Form } from "@rivetjs/ui/form";
import { Label } from "@rivetjs/ui/label";
import { signal } from "@rivetjs/reactivity";
import { parseColor } from "@rivetjs/cdk/color";

export const head = { title: "ColorField: Form Example" };

// #region demo
export function FormExample() {
  // Rivet: a controlled value is a two-way signal of the color string (Color instances are not resumable).
  const value = signal<string | null>(null);
  const isSubmitting = signal(false);

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();

    if (!value()) {
      return;
    }

    isSubmitting.set(true);

    // Simulate API call
    setTimeout(() => {
      console.log("Color submitted:", { color: parseColor(value()!).toString("hex") });
      value.set(null);
      isSubmitting.set(false);
    }, 1500);
  };

  return (
    <Form class="flex w-[280px] flex-col gap-4" onSubmit={handleSubmit}>
      <ColorField fullWidth isRequired class="w-full" name="brand-color" value={value}>
        <Label>Brand Color</Label>
        <ColorField.Group>
          <ColorField.Prefix>
            <ColorSwatch color={() => value() ?? undefined} size="xs" />
          </ColorField.Prefix>
          <ColorField.Input placeholder="#000000" />
        </ColorField.Group>
        <Description>Choose your brand's primary color</Description>
      </ColorField>
      <Button class="w-full" isDisabled={!value()} isPending={isSubmitting()} type="submit" variant="primary">
        {isSubmitting() ? "Saving..." : "Save Color"}
      </Button>
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
