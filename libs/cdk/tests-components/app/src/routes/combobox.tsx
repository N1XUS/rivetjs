import { signal } from "@rivetjs/reactivity";
import { ComboBox, ComboBoxValue, type Key } from "@rivetjs/cdk/combobox";
import { Button } from "@rivetjs/cdk/button";
import { Group } from "@rivetjs/cdk/group";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { ListBox, ListBoxItem } from "@rivetjs/cdk/listbox";
import { Popover } from "@rivetjs/cdk/popover";
import { Text } from "@rivetjs/cdk/text";
import { FieldError } from "@rivetjs/cdk/form";

export const head = { title: "ComboBox" };

const fruits = [
  { key: "apple", label: "Apple" },
  { key: "apricot", label: "Apricot" },
  { key: "banana", label: "Banana" },
  { key: "cherry", label: "Cherry", disabled: true },
  { key: "creme", label: "Crème de cassis" },
  { key: "date", label: "Date" },
];

// RAC ComboBox stories: data items (items preset), static items, custom value, multiple, validation.
export default function ComboBoxStory() {
  const picked = signal<Key | null>(null);
  const text = signal("");
  const multi = signal<readonly Key[]>(["apple"]);
  const log = signal("");
  const append = (entry: string) => log.update((l) => (l ? l + " " : "") + entry);
  return (
    <section>
      <h1>ComboBox</h1>
      <form method="get" action="/combobox">
        <ComboBox id="fruit" name="fruit" defaultItems={fruits} selectedKey={picked} disabledKeys={["cherry"]} onOpenChange={(open) => append("open:" + open)}>
          <Label>Fruit</Label>
          <Group>
            <Input />
            <Button id="fruit-button">Show</Button>
          </Group>
          <Text slot="description">Pick a fruit</Text>
          <Popover>
            <ListBox />
          </Popover>
        </ComboBox>
        <button type="submit">Send</button>
      </form>
      <p id="combo-value">Picked: {picked() ?? "none"}</p>
      <p id="combo-log">{log()}</p>

      <ComboBox id="static" menuTrigger="focus">
        <Label>Static</Label>
        <Input />
        <Popover>
          <ListBox>
            <ListBoxItem id="one">One</ListBoxItem>
            <ListBoxItem id="two">Two</ListBoxItem>
            <ListBoxItem id="three">Three</ListBoxItem>
          </ListBox>
        </Popover>
      </ComboBox>

      <ComboBox id="custom" name="custom" allowsCustomValue inputValue={text} defaultItems={fruits}>
        <Label>Custom value</Label>
        <Input />
        <Popover>
          <ListBox />
        </Popover>
      </ComboBox>
      <p id="custom-value">Text: {text()}</p>

      <ComboBox id="multi" name="multi" selectionMode="multiple" value={multi} defaultItems={fruits}>
        <Label>Multiple</Label>
        <ComboBoxValue id="multi-value" placeholder="None" />
        <Group>
          <Input />
          <Button id="multi-button">Show</Button>
        </Group>
        <Popover>
          <ListBox />
        </Popover>
      </ComboBox>

      <form id="required-form">
        {/* Native validation (default): RS commits it on blur; aria mode has no required error (RS: only validate / isInvalid). */}
        <ComboBox id="required" name="required" isRequired defaultItems={fruits}>
          <Label>Required</Label>
          <Input />
          <FieldError />
          <Popover>
            <ListBox />
          </Popover>
        </ComboBox>
      </form>
      <div class="spacer"></div>
    </section>
  );
}
