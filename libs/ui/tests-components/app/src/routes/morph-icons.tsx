// Morph icons on a resumed page (TWEAKS.md TW-149; `morph-icons.test.ts`; roots by `data-testid`): default morph chevron in
// Select `mi-sel`, ComboBox `mi-cb`, Autocomplete `mi-ac`, CellSelect `mi-cs`, NativeSelect `mi-ns`; a Select with a custom
// lucide indicator child `mi-sel-custom` (keeps the rotate); a Select under `data-reduce-motion="true"` `mi-sel-rm`; a Navbar
// `#mi-nav` with the default morph burger toggle `#mi-nav-toggle`; a CellSelect with a custom indicator child `mi-cs-custom`;
// `#mi-ink`: lucide ChevronDown (16 px) / Menu / X (20 px) next to the bare morph classes, black on white (ink comparison).
import { Icon } from "@rivetjs/kit/icon";
import { Autocomplete } from "@rivetjs/ui/autocomplete";
import { CellSelect } from "@rivetjs/ui/cell-select";
import { ComboBox } from "@rivetjs/ui/combo-box";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { NativeSelect } from "@rivetjs/ui/native-select";
import { Navbar } from "@rivetjs/ui/navbar";
import { Select } from "@rivetjs/ui/select";
import { ChevronDown, Menu, X } from "lucide";

export default function MorphIconStories() {
  return (
    <div class="flex flex-col gap-6 p-6">
      <Navbar id="mi-nav" aria-label="Main" position="static">
        <Navbar.Header>
          <Navbar.MenuToggle id="mi-nav-toggle" />
          <Navbar.Brand>Acme</Navbar.Brand>
        </Navbar.Header>
        <Navbar.Menu>
          <Navbar.MenuItem href="/morph-icons#a">A</Navbar.MenuItem>
        </Navbar.Menu>
      </Navbar>
      <div class="flex flex-wrap gap-4">
        <Select data-testid="mi-sel" class="w-[200px]" label="State" placeholder="Select one">
          <Select.Item id="florida">Florida</Select.Item>
          <Select.Item id="texas">Texas</Select.Item>
        </Select>
        <Select data-testid="mi-sel-custom" class="w-[200px]" placeholder="Select one">
          <Label>Custom</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator>
              <Icon icon={ChevronDown} size={16} />
            </Select.Indicator>
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="a" textValue="A">
                A
              </ListBox.Item>
            </ListBox>
          </Select.Popover>
        </Select>
        <div data-reduce-motion="true">
          <Select data-testid="mi-sel-rm" class="w-[200px]" label="Reduced" placeholder="Select one">
            <Select.Item id="florida">Florida</Select.Item>
          </Select>
        </div>
        <ComboBox data-testid="mi-cb" class="w-[200px]" label="Animal" placeholder="Search">
          <ComboBox.Item id="cat">Cat</ComboBox.Item>
          <ComboBox.Item id="dog">Dog</ComboBox.Item>
        </ComboBox>
        <Autocomplete data-testid="mi-ac" class="w-[200px]" label="City" placeholder="Pick a city" searchLabel="Search cities">
          <Autocomplete.Item id="berlin">Berlin</Autocomplete.Item>
          <Autocomplete.Item id="paris">Paris</Autocomplete.Item>
        </Autocomplete>
        <CellSelect data-testid="mi-cs" class="w-72" label="Appearance" defaultValue="system">
          <CellSelect.Item id="light">Light</CellSelect.Item>
          <CellSelect.Item id="system">System</CellSelect.Item>
        </CellSelect>
        <CellSelect data-testid="mi-cs-custom" class="w-72" defaultValue="system">
          <CellSelect.Trigger>
            <CellSelect.Label>Custom</CellSelect.Label>
            <CellSelect.Value />
            <CellSelect.Indicator>
              <Icon icon={ChevronDown} size={16} />
            </CellSelect.Indicator>
          </CellSelect.Trigger>
          <CellSelect.Popover>
            <ListBox>
              <ListBox.Item id="light" textValue="Light">
                Light
              </ListBox.Item>
              <ListBox.Item id="system" textValue="System">
                System
              </ListBox.Item>
            </ListBox>
          </CellSelect.Popover>
        </CellSelect>
        <NativeSelect
          data-testid="mi-ns"
          class="w-[200px]"
          label="Tea"
          defaultValue="green"
          items={[
            { value: "green", label: "Green" },
            { value: "black", label: "Black" },
          ]}
        />
      </div>
      <div id="mi-ink" class="flex items-center gap-4 p-2" style={{ color: "#000", background: "#fff" }}>
        <Icon data-ink="chevron-lucide" icon={ChevronDown} size={16} />
        <span data-ink="chevron-morph" class="morph-chevron" />
        <Icon data-ink="menu-lucide" icon={Menu} size={20} />
        <span data-ink="menu-morph" class="morph-burger">
          <span />
        </span>
        <Icon data-ink="x-lucide" icon={X} size={20} />
        <span data-ink="x-morph" class="morph-burger" data-open="true">
          <span />
        </span>
      </div>
    </div>
  );
}
