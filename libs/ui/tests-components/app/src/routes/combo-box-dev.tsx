// COMBOBOX-DEV (2026-10-08): ComboBoxes for the dev-server test (`combo-box-dev.test.ts`). `cbd` = the ui-docs default demo
// (Label, InputGroup with Input + Trigger, ListBox items without Label / Description: the input's
// `aria-describedby` names nothing, the options' label / description slot ids are dropped); `cbd-desc` adds a
// Description (its input is described by the slot id) and a FieldError (renders only while invalid).
import { ComboBox } from "@rivetjs/ui/combo-box";
import { Description } from "@rivetjs/ui/description";
import { FieldError } from "@rivetjs/ui/field-error";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";

export default function ComboBoxDevStories() {
  return (
    <section class="flex flex-col gap-8 p-10">
      <ComboBox data-testid="cbd" class="w-[256px]">
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
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>

      <ComboBox data-testid="cbd-desc" class="w-[256px]">
        <Label>Pet</Label>
        <ComboBox.InputGroup>
          <Input placeholder="Search pets..." />
          <ComboBox.Trigger />
        </ComboBox.InputGroup>
        <Description data-testid="cbd-desc-description">Pick one</Description>
        <FieldError />
        <ComboBox.Popover>
          <ListBox>
            <ListBox.Item id="cat" textValue="Cat">
              Cat
            </ListBox.Item>
            <ListBox.Item id="dog" textValue="Dog">
              Dog
            </ListBox.Item>
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>
    </section>
  );
}
