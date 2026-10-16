import { FieldError, Form } from "@rivetjs/cdk/form";
import { Button } from "@rivetjs/cdk/button";
import { ComboBox } from "@rivetjs/cdk/combobox";
import { Group } from "@rivetjs/cdk/group";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { ListBox } from "@rivetjs/cdk/listbox";
import { Popover } from "@rivetjs/cdk/popover";
import { ChevronDown } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "ComboBox: validation" };

const cities = [
  { id: "ams", name: "Amsterdam" },
  { id: "ber", name: "Berlin" },
  { id: "bog", name: "Bogotá" },
  { id: "lis", name: "Lisbon" },
  { id: "mad", name: "Madrid" },
  { id: "zur", name: "Zürich" },
];

// #region demo
export default function Validation() {
  return (
    <Form class="m-4 grid max-w-sm gap-4 text-sm" method="get">
      {() => (
        <>
          <ComboBox id="city" defaultItems={cities} name="city" isRequired>
            <Label>City</Label>
            <Group>
              <Input placeholder="Type a city" />
              <Button aria-label="Show cities">
                <Icon icon={ChevronDown} />
              </Button>
            </Group>
            <FieldError class="text-red-700" />
            <Popover>
              <ListBox />
            </Popover>
          </ComboBox>
          <ComboBox id="free" name="free" allowsCustomValue defaultItems={cities}>
            <Label>Any city</Label>
            <Input />
            <Popover>
              <ListBox />
            </Popover>
          </ComboBox>
          <button id="submit" type="submit" class="justify-self-start rounded border px-3 py-1">
            Submit
          </button>
        </>
      )}
    </Form>
  );
}
// #endregion
