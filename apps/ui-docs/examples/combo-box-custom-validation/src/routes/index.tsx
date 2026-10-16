// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/combo-box/custom-validation.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { ComboBox } from "@rivetjs/ui/combo-box";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "ComboBox: Custom Validation" };

// #region demo
const animals = [
  { id: "aardvark", name: "Aardvark" },
  { id: "cat", name: "Cat" },
  { id: "dog", name: "Dog" },
  { id: "kangaroo", name: "Kangaroo" },
  { id: "panda", name: "Panda" },
  { id: "snake", name: "Snake" },
];

export function CustomValidation() {
  return (
    <Form
      class="flex w-[256px] flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        alert("Form submitted successfully!");
      }}
    >
      <ComboBox
        isRequired
        class="w-full"
        name="animal"
        validate={(value) => {
          if (value.selectedKey == null) {
            return "Please select an animal";
          }

          if (value.selectedKey === "snake") {
            return "Snakes are not allowed";
          }

          return true;
        }}
      >
        <Label>Favorite Animal</Label>
        <ComboBox.InputGroup>
          <Input placeholder="Search animals..." />
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
        <FieldError />
      </ComboBox>
      <Button class="w-fit" type="submit">
        Submit
      </Button>
    </Form>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CustomValidation />
    </div>
  );
}
