// NumberField stories (lane C4a): a RAC-composed NumberField over a two-way Signal with stepper Buttons, a
// currency field in a native form (hidden input), on a resumed page. Typing, Enter commit, arrows, stepper
// presses and wheel must work after resume.
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { FieldError } from "@rivetjs/cdk/form";
import { Group } from "@rivetjs/cdk/group";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { NumberField } from "@rivetjs/cdk/number-field";
import { Text } from "@rivetjs/cdk/text";

export default function NumberFieldStories() {
  const width = signal<number | null>(1024);
  return (
    <main>
      <h1>NumberField</h1>
      <NumberField id="width" value={width} minValue={0} step={1}>
        <Label>Width</Label>
        <Group>
          <Button slot="decrement">-</Button>
          <Input />
          <Button slot="increment">+</Button>
        </Group>
        <Text slot="description">Pixels</Text>
        <FieldError />
      </NumberField>
      <output id="width-value">{String(width())}</output>
      <form id="price-form">
        <NumberField id="price" name="price" defaultValue={25} formatOptions={{ style: "currency", currency: "USD" }} isRequired>
          <Label>Price</Label>
          <Group>
            <Input />
            <Button slot="increment">+</Button>
          </Group>
        </NumberField>
      </form>
      {/* FieldErrorContext on a resumed page (G-PAR/K): the error renders after the first invalid commit. */}
      <NumberField id="limit" defaultValue={5} validationBehavior="aria" validate={(value) => (value > 10 ? "At most 10" : null)}>
        <Label>Limit</Label>
        <Group>
          <Input />
        </Group>
        <FieldError />
      </NumberField>
    </main>
  );
}
