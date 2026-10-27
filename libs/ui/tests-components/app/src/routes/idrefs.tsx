// Generated IDREF roots must survive independent part adoption; explicit ids are tested separately.
import { ComboBox } from "@rivetjs/ui/combo-box";
import { Select } from "@rivetjs/ui/select";
import { Tabs } from "@rivetjs/ui/tabs";
import { Dropdown } from "@rivetjs/ui/dropdown";
import { ListBox } from "@rivetjs/ui/list-box";
import { Label } from "@rivetjs/ui/label";
import { Description } from "@rivetjs/ui/description";
import { Header } from "@rivetjs/ui/header";

export default function IdrefsStories() {
  return (
    <main class="flex flex-col gap-8 p-10">
      <div id="ir-combo">
        <ComboBox label="Animal" placeholder="Choose an animal">
          <ComboBox.Item id="cat">Cat</ComboBox.Item>
          <ComboBox.Item id="dog">Dog</ComboBox.Item>
        </ComboBox>
      </div>
      <div id="ir-select">
        <Select>
          <Label>State</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="ca">California</ListBox.Item>
              <ListBox.Item id="ny">New York</ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
      </div>
      <div id="ir-tabs">
        <Tabs>
          <Tabs.List aria-label="Views">
            <Tabs.Tab id="one">One</Tabs.Tab>
            <Tabs.Tab id="two">Two</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel id="one">First</Tabs.Panel>
          <Tabs.Panel id="two">{() => <p>Second</p>}</Tabs.Panel>
        </Tabs>
      </div>
      <div id="ir-menu">
        <Dropdown>
          <Dropdown.Trigger>Actions</Dropdown.Trigger>
          <Dropdown.Menu>
            <Dropdown.Item id="copy">Copy</Dropdown.Item>
            <Dropdown.Item id="paste">Paste</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>
      <div id="ir-list">
        <ListBox aria-label="Fruit" selectionMode="single">
          <ListBox.Section>
            <Header>Available fruit</Header>
            <ListBox.Item id="apple" textValue="Apple">
              <Label>Apple</Label>
              <Description>Red fruit</Description>
            </ListBox.Item>
            <ListBox.Item id="pear" textValue="Pear">
              <Label>Pear</Label>
              <Description>Green fruit</Description>
            </ListBox.Item>
          </ListBox.Section>
        </ListBox>
      </div>
    </main>
  );
}
