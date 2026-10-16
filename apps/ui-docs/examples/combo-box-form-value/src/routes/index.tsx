// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/combo-box/form-value.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { ComboBox } from "@rivetjs/ui/combo-box";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "ComboBox: Form Value" };

// #region demo
const animals = [
  { id: "aardvark", name: "Aardvark" },
  { id: "cat", name: "Cat" },
  { id: "dog", name: "Dog" },
  { id: "kangaroo", name: "Kangaroo" },
  { id: "panda", name: "Panda" },
  { id: "snake", name: "Snake" },
];

export function FormValue() {
  const message = signal<string | null>(null);

  return (
    <Form
      class="flex w-[256px] flex-col gap-4"
      onSubmit={(e: SubmitEvent) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget as HTMLFormElement);

        message.set(`Key: ${formData.get("animal")}. Text: ${formData.get("animal-text")}.`);
      }}
    >
      <ComboBox isRequired class="w-full" formValue="key" name="animal">
        <Label>Animal</Label>
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
        <Description>Submits the selected key</Description>
        <FieldError />
      </ComboBox>
      <ComboBox isRequired class="w-full" formValue="text" name="animal-text">
        <Label>Animal (text)</Label>
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
        <Description>Submits the selected text</Description>
        <FieldError />
      </ComboBox>
      <Button class="w-fit" type="submit">
        Submit
      </Button>
      {message() ? <p class="text-sm text-muted">{message()}</p> : null}
    </Form>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <FormValue />
    </div>
  );
}
