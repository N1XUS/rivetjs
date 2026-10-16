// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/number-field/form-example.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Label } from "@rivetjs/ui/label";
import { NumberField } from "@rivetjs/ui/number-field";
import { Spinner } from "@rivetjs/ui/spinner";

export const head = { title: "NumberField: Form Example" };

// #region demo
export function FormExample() {
  const value = signal<number | null>(null);
  const isSubmitting = signal(false);
  const STOCK_AVAILABLE = 3;
  const isOutOfStock = () => value() != null && value()! > STOCK_AVAILABLE;

  const handleSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const v = value();

    if (v === null || v < 1 || v > STOCK_AVAILABLE) {
      return;
    }

    isSubmitting.set(true);

    // Simulate API call
    setTimeout(() => {
      console.log("Order submitted:", { quantity: v });
      value.set(null);
      isSubmitting.set(false);
    }, 1500);
  };

  return (
    <Form class="flex w-[280px] flex-col gap-4" onSubmit={handleSubmit}>
      <NumberField isRequired isInvalid={isOutOfStock} maxValue={5} minValue={1} name="quantity" value={value}>
        <Label>Order quantity</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input class="w-[120px]" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        {isOutOfStock() ? (
          <FieldError>Only {STOCK_AVAILABLE} items left in stock</FieldError>
        ) : (
          <Description>Only {STOCK_AVAILABLE} items available</Description>
        )}
      </NumberField>
      <Button
        class="w-full"
        isDisabled={() => value() == null || value()! < 1 || value()! > STOCK_AVAILABLE}
        isPending={isSubmitting}
        type="submit"
        variant="primary"
      >
        {isSubmitting() ? (
          <>
            <Spinner color="current" size="sm" />
            Processing...
          </>
        ) : (
          "Place Order"
        )}
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
