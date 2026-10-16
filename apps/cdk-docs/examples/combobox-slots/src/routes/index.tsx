import { Button } from "@rivetjs/cdk/button";
import { ComboBox } from "@rivetjs/cdk/combobox";
import { Group } from "@rivetjs/cdk/group";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { ListBox, ListBoxItem, ListBoxSection } from "@rivetjs/cdk/listbox";
import { Header } from "@rivetjs/cdk/header";
import { Text } from "@rivetjs/cdk/text";
import { Popover } from "@rivetjs/cdk/popover";
import { ChevronDown } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "ComboBox: sections" };

// #region demo
export default function Sections() {
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <ComboBox id="food">
        <Label>Food</Label>
        <Group>
          <Input />
          <Button aria-label="Show food">
            <Icon icon={ChevronDown} />
          </Button>
        </Group>
        <Text slot="description">Fruit or vegetable</Text>
        <Popover>
          <ListBox>
            <ListBoxSection id="fruit">
              <Header>Fruit</Header>
              <ListBoxItem id="apple" textValue="Apple">
                <b>Apple</b> <span class="text-slate-500">crisp</span>
              </ListBoxItem>
              <ListBoxItem id="banana">Banana</ListBoxItem>
            </ListBoxSection>
            <ListBoxSection id="veg">
              <Header>Vegetables</Header>
              <ListBoxItem id="cabbage">Cabbage</ListBoxItem>
              <ListBoxItem id="pepper">Pepper</ListBoxItem>
            </ListBoxSection>
          </ListBox>
        </Popover>
      </ComboBox>
    </div>
  );
}
// #endregion
