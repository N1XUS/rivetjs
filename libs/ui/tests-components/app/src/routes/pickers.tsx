// P3-COLLECTIONS pickers on a resumed page (RAC Select root takes no `id`: `data-testid`). Select `sel` (Label "State", Trigger `#sel-trigger` with Value + ClearButton +
// Indicator, three states, `defaultValue="california"`, `onChange` key echoed in `#sel-value`, `onClear` count in `#sel-cleared`);
// multiple Select `selm` (value signal echoed in `#selm-value`); ComboBox `cb` (Label "Animal", InputGroup with Input `#cb-input` +
// Trigger `#cb-trigger`, three animals, `onChange` key echoed in `#cb-value`); Autocomplete `ac` (Filter + SearchField + ListBox, ClearButton,
// `onChange` key echoed in `#ac-value`); multiple Autocomplete `acm` (selected animals as removable tags in the trigger, upstream fixture).
// Shorthand (identity T22): ComboBox `cb-auto` (`label` + `ComboBox.Item`s, value signal → `#cb-auto-value`), Autocomplete `ac-auto`
// (`label` + `items` render function, default filter, value signal → `#ac-auto-value`).
import { signal } from "@rivetjs/reactivity";
import type { Key } from "@rivetjs/cdk/select";
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { selectedKeys } from "@rivetjs/cdk/select";
import { Autocomplete } from "@rivetjs/ui/autocomplete";
import { ComboBox } from "@rivetjs/ui/combo-box";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { SearchField } from "@rivetjs/ui/search-field";
import { Tag } from "@rivetjs/ui/tag";
import { TagGroup } from "@rivetjs/ui/tag-group";
import { Select } from "@rivetjs/ui/select";

const animals = [
  { id: "cat", name: "Cat" },
  { id: "dog", name: "Dog" },
  { id: "panda", name: "Panda" },
];
const { contains } = createFilter({ sensitivity: "base" }, "en-US");

export default function PickersStories() {
  const selValue = signal("california");
  const cleared = signal(0);
  const multi = signal<readonly Key[]>(["cat"]);
  const cbValue = signal("");
  const acValue = signal("");
  const acmValue = signal<readonly Key[]>(["cat", "dog", "panda"]);
  const cbAuto = signal<Key | null>(null);
  const acAuto = signal<Key | null>(null);
  return (
    <section class="flex flex-col gap-8 p-10">
      <Select
        data-testid="sel"
        class="w-[256px]"
        defaultValue="california"
        placeholder="Select one"
        onChange={(key) => selValue.set(String(key))}
        onClear={() => cleared.set(cleared() + 1)}
      >
        <Label>State</Label>
        <Select.Trigger id="sel-trigger">
          <Select.Value />
          <Select.ClearButton />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            <ListBox.Item id="florida" textValue="Florida">
              Florida
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="california" textValue="California">
              California
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="texas" textValue="Texas">
              Texas
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
      <output id="sel-value">{selValue()}</output>
      <output id="sel-cleared">{cleared()}</output>

      <Select data-testid="selm" class="w-[256px]" selectionMode="multiple" value={multi} placeholder="Pick pets">
        <Label>Pets</Label>
        <Select.Trigger id="selm-trigger">
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox selectionMode="multiple">
            <ListBox.Item id="cat" textValue="Cat">
              Cat
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="dog" textValue="Dog">
              Dog
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </Select.Popover>
      </Select>
      <output id="selm-value">{multi().join(",")}</output>

      <ComboBox data-testid="cb" class="w-[256px]" onChange={(key) => cbValue.set(String(key))}>
        <Label>Animal</Label>
        <ComboBox.InputGroup>
          <Input id="cb-input" placeholder="Search animals..." />
          <ComboBox.Trigger id="cb-trigger" />
        </ComboBox.InputGroup>
        <ComboBox.Popover>
          <ListBox>
            <ListBox.Item id="cat" textValue="Cat">
              Cat
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="dog" textValue="Dog">
              Dog
              <ListBox.ItemIndicator />
            </ListBox.Item>
            <ListBox.Item id="panda" textValue="Panda">
              Panda
              <ListBox.ItemIndicator />
            </ListBox.Item>
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>
      <output id="cb-value">{cbValue()}</output>

      <Autocomplete data-testid="ac" class="w-[256px]" placeholder="Select an animal" onChange={(key) => acValue.set(String(key))}>
        <Label>Favorite Animal</Label>
        <Autocomplete.Trigger>
          <Autocomplete.Value />
          <Autocomplete.ClearButton />
          <Autocomplete.Indicator />
        </Autocomplete.Trigger>
        <Autocomplete.Popover>
          <Autocomplete.Filter filter={(text, input) => contains(text, input)}>
            <SearchField autoFocus aria-label="Search animals" name="search" variant="secondary">
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search animals..." />
                <SearchField.ClearButton />
              </SearchField.Group>
            </SearchField>
            <ListBox>
              <ListBox.Item id="cat" textValue="Cat">
                Cat
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="dog" textValue="Dog">
                Dog
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="panda" textValue="Panda">
                Panda
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Autocomplete.Filter>
        </Autocomplete.Popover>
      </Autocomplete>
      <output id="ac-value">{acValue()}</output>

      <Autocomplete data-testid="acm" class="w-[320px]" placeholder="Select animals" selectionMode="multiple" value={acmValue}>
        <Label>Favorite Animals</Label>
        <Autocomplete.Trigger>
          <Autocomplete.Value>
            {({ defaultChildren, isPlaceholder, state }) =>
              isPlaceholder() || selectedKeys(state).length === 0 ? (
                defaultChildren
              ) : (
                <TagGroup aria-label="Selected animals" size="sm" onRemove={(keys) => acmValue.set(acmValue().filter((key) => !keys.has(key)))}>
                  <TagGroup.List>
                    {selectedKeys(state).map((key) => {
                      const item = animals.find((animal) => animal.id === key);
                      return item ? <Tag id={item.id}>{item.name}</Tag> : null;
                    })}
                  </TagGroup.List>
                </TagGroup>
              )
            }
          </Autocomplete.Value>
          <Autocomplete.Indicator />
        </Autocomplete.Trigger>
        <Autocomplete.Popover>
          <Autocomplete.Filter filter={(text, input) => contains(text, input)}>
            <SearchField autoFocus aria-label="Search animals" name="search" variant="secondary">
              <SearchField.Group>
                <SearchField.Input placeholder="Search animals..." />
              </SearchField.Group>
            </SearchField>
            <ListBox selectionMode="multiple">
              <ListBox.Item id="cat" textValue="Cat">
                Cat
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="dog" textValue="Dog">
                Dog
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="panda" textValue="Panda">
                Panda
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </Autocomplete.Filter>
        </Autocomplete.Popover>
      </Autocomplete>
      <output id="acm-value">{acmValue().join(",")}</output>
      <ComboBox data-testid="cb-auto" class="w-[256px]" label="Pet" placeholder="Search pets" value={cbAuto}>
        <ComboBox.Item id="cat">Cat</ComboBox.Item>
        <ComboBox.Item id="dog">Dog</ComboBox.Item>
      </ComboBox>
      <output id="cb-auto-value">{String(cbAuto())}</output>
      <Autocomplete data-testid="ac-auto" class="w-[256px]" label="Animal" placeholder="Pick one" items={animals} value={acAuto}>
        {(item: { id: string; name: string }) => <Autocomplete.Item id={item.id}>{item.name}</Autocomplete.Item>}
      </Autocomplete>
      <output id="ac-auto-value">{String(acAuto())}</output>
    </section>
  );
}
