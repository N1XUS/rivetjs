// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/combo-box/validation-behavior.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { ComboBox } from "@rivetjs/ui/combo-box";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "ComboBox: Validation Behavior" };

// #region demo
const animals = [
  { id: "aardvark", name: "Aardvark" },
  { id: "cat", name: "Cat" },
  { id: "dog", name: "Dog" },
  { id: "kangaroo", name: "Kangaroo" },
  { id: "panda", name: "Panda" },
  { id: "snake", name: "Snake" },
];

export function ValidationBehavior() {
  const nativeMessage = signal<string | null>(null);
  const ariaMessage = signal<string | null>(null);

  return (
    <div class="flex flex-col gap-8">
      <Form
        class="flex w-[256px] flex-col gap-4"
        onSubmit={(e: SubmitEvent) => {
          e.preventDefault();
          nativeMessage.set("Submitted with native validation.");
        }}
      >
        <ComboBox isRequired class="w-full" name="animal" validationBehavior="native">
          <Label>Animal (native)</Label>
          <ComboBox.InputGroup>
            <Input placeholder="Select an animal..." />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <ComboBox.Popover>
            <ListBox>
              {animals.map((animal) => (
                <ListBox.Item id={animal.id} textValue={animal.name}>
                  {animal.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </ComboBox.Popover>
          <Description>Blocks submission when the value is missing</Description>
          <FieldError />
        </ComboBox>
        <Button class="w-fit" type="submit">
          Submit
        </Button>
        {nativeMessage() ? <p class="text-sm text-muted">{nativeMessage()}</p> : null}
      </Form>
      <Form
        class="flex w-[256px] flex-col gap-4"
        onSubmit={(e: SubmitEvent) => {
          e.preventDefault();
          ariaMessage.set("Submitted with ARIA validation.");
        }}
      >
        <ComboBox isRequired class="w-full" name="animal-aria" validationBehavior="aria">
          <Label>Animal (ARIA)</Label>
          <ComboBox.InputGroup>
            <Input placeholder="Select an animal..." />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <ComboBox.Popover>
            <ListBox>
              {animals.map((animal) => (
                <ListBox.Item id={animal.id} textValue={animal.name}>
                  {animal.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </ComboBox.Popover>
          <Description>Shows errors in realtime and does not block submission</Description>
          <FieldError />
        </ComboBox>
        <Button class="w-fit" type="submit">
          Submit
        </Button>
        {ariaMessage() ? <p class="text-sm text-muted">{ariaMessage()}</p> : null}
      </Form>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <ValidationBehavior />
    </div>
  );
}
