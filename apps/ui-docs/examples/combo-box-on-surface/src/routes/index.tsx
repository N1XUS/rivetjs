// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/combo-box/on-surface.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { Button } from "@rivetjs/ui/button";
import { ComboBox } from "@rivetjs/ui/combo-box";
import { FieldError } from "@rivetjs/ui/field-error";
import { Form } from "@rivetjs/ui/form";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { Surface } from "@rivetjs/ui/surface";

export const head = { title: "ComboBox: In Surface" };

// #region demo
export function OnSurface() {
  const onSubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const data: Record<string, string> = {};

    formData.forEach((value, key) => {
      data[key] = value.toString();
    });

    alert("Form submitted successfully!");
  };

  return (
    <Surface class="w-[320px] rounded-3xl p-6">
      <Form class="flex w-full flex-col gap-4" onSubmit={onSubmit}>
        <ComboBox isRequired class="w-full" name="animal" variant="secondary">
          <Label>Favorite Animal</Label>
          <ComboBox.InputGroup>
            <Input placeholder="Search animals..." />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <ComboBox.Popover>
            <ListBox>
              <ListBox.Item id="aardvark" textValue="Aardvark">
                Aardvark
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="cat" textValue="Cat">
                Cat
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="dog" textValue="Dog">
                Dog
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="kangaroo" textValue="Kangaroo">
                Kangaroo
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="panda" textValue="Panda">
                Panda
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="snake" textValue="Snake">
                Snake
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </ComboBox.Popover>
          <FieldError />
        </ComboBox>
        <Button type="submit">Submit</Button>
      </Form>
    </Surface>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <OnSurface />
    </div>
  );
}
