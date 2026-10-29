// Rivet-authored Radio demo (own content): shorthand, composed parts, a render function and a disabled choice.
import type { RadioFieldRenderProps } from "@rivetjs/cdk/radio-group";
import { signal } from "@rivetjs/reactivity";
import { Description } from "@rivetjs/ui/description";
import { Label } from "@rivetjs/ui/label";
import { Radio } from "@rivetjs/ui/radio";
import { RadioGroup } from "@rivetjs/ui/radio-group";

export const head = { title: "Radio: Parts and States" };

// #region demo
export function PartsAndStates() {
  const shipping = signal<string | null>("standard");

  return (
    <div class="flex flex-col gap-4">
      <RadioGroup id="radio-shipping" name="shipping" value={shipping}>
        <Label>Shipping</Label>
        {/* Shorthand: label + description, no children. */}
        <Radio value="standard" label="Standard" description="3 to 5 business days, free" />
        {/* Composed parts. */}
        <Radio value="express">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Express
          </Radio.Content>
          <Description>Next business day, $12</Description>
        </Radio>
        {/* A render function reads the field state. */}
        <Radio value="pickup">
          {(state: RadioFieldRenderProps) => (
            <>
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                Store pickup
              </Radio.Content>
              <Description>{state.isSelected() ? "We email you when it is ready" : "Free, from our Berlin store"}</Description>
            </>
          )}
        </Radio>
        <Radio value="drone" label="Drone delivery" description="Not available in your area" isDisabled />
      </RadioGroup>
      <p id="radio-shipping-value" class="text-sm text-muted">
        Selected: {shipping() ?? "none"}
      </p>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <PartsAndStates />
    </div>
  );
}
