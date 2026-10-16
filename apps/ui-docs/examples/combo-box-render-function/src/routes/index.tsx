// Port of HeroUI v3.2.6 `apps/docs/src/demos/en/combo-box/render-function.tsx` (Apache-2.0, © 2025 NextUI Inc.; modified).
import { ComboBox } from "@rivetjs/ui/combo-box";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";

export const head = { title: "ComboBox: Render Function" };

// #region demo
export function RenderFunction() {
  return (
    <ComboBox class="w-[256px]" render={(props) => <div {...props} data-custom="foo" />}>
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
    </ComboBox>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <RenderFunction />
    </div>
  );
}
