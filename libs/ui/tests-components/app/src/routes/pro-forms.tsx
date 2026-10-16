// Pro-forms lane components on a resumed page (Rivet additions; feature sets inspired by HeroUI Pro's public docs, independent
// implementations). Sections: `#seg` Segment (two-way `selectedKey` → `#seg-state`, separators, disabled item); `#ns` NativeSelect
// (two-way value → `#ns-state`, label + description, optgroup, required); `#rbg` RadioButtonGroup (two-way value → `#rbg-state`,
// indicator, icon, description, disabled item); `#cbg` CheckboxButtonGroup (two-way string[] → `#cbg-state`); `#nst`
// NumberStepper (two-way value → `#nst-state`, min 0 / max 10); `#csl` CellSlider (two-way value → `#csl-state`, step 10); `#csel` CellSelect (two-way value → `#csel-state`); `#isel` InlineSelect
// as a Breadcrumbs item switcher (two-way value → `#isel-state`). Shorthand (UI identity T21): `#sh-rbg` RadioButtonGroup `items`
// (→ `#sh-rbg-state`), `#sh-cbg` CheckboxButtonGroup `items` (→ `#sh-cbg-state`). Shorthand (T22): `#sh-csel` CellSelect `label` +
// `CellSelect.Item`s (→ `#sh-csel-state`), `#sh-isel` InlineSelect `items` (→ `#sh-isel-state`), `#sh-csl` CellSlider `label` (→ `#sh-csl-state`).
import { signal } from "@rivetjs/reactivity";
import { Segment } from "@rivetjs/ui/segment";
import { NativeSelect } from "@rivetjs/ui/native-select";
import { Label } from "@rivetjs/ui/label";
import { Description } from "@rivetjs/ui/description";
import { RadioButtonGroup } from "@rivetjs/ui/radio-button-group";
import { CheckboxButtonGroup } from "@rivetjs/ui/checkbox-button-group";
import { NumberStepper } from "@rivetjs/ui/number-stepper";
import { CellSlider } from "@rivetjs/ui/cell-slider";
import { CellSelect } from "@rivetjs/ui/cell-select";
import { InlineSelect } from "@rivetjs/ui/inline-select";
import { Breadcrumbs } from "@rivetjs/ui/breadcrumbs";
import { ListBox } from "@rivetjs/ui/list-box";

export default function ProFormsStories() {
  const view = signal<string | null>("week");
  const density = signal<string | number | null>("compact");
  const cadence = signal<string | number | null>("week");
  const cadences = [
    { id: "day", name: "day" },
    { id: "week", name: "week" },
  ];
  const opacity = signal(50);
  const country = signal("de");
  const plan = signal<string | null>("team");
  const extras = signal<string[]>(["backup"]);
  const guests = signal<number | null>(9);
  const volume = signal(40);
  const theme = signal<string | number | null>("system");
  const project = signal<string | number | null>("web");
  const size = signal<string | null>("s");
  const channels = signal<string[]>([]);
  return (
    <section class="flex w-[28rem] flex-col gap-8 p-10">
      <button id="before" type="button">
        Before
      </button>
      <Segment aria-label="Range" id="seg" selectedKey={view}>
        <Segment.Item id="day">Day</Segment.Item>
        <Segment.Separator />
        <Segment.Item id="week">Week</Segment.Item>
        <Segment.Separator />
        <Segment.Item id="month">Month</Segment.Item>
        <Segment.Separator />
        <Segment.Item id="year" isDisabled>
          Year
        </Segment.Item>
      </Segment>
      <span id="seg-state">{String(view())}</span>
      <div id="ns">
        <NativeSelect value={country} name="country" isRequired>
          <Label>Country</Label>
          <NativeSelect.Trigger>
            <NativeSelect.OptGroup label="Europe">
              <NativeSelect.Option value="fr">France</NativeSelect.Option>
              <NativeSelect.Option value="de">Germany</NativeSelect.Option>
            </NativeSelect.OptGroup>
            <NativeSelect.Option value="jp">Japan</NativeSelect.Option>
          </NativeSelect.Trigger>
          <Description>Used for shipping</Description>
        </NativeSelect>
      </div>
      <span id="ns-state">{country()}</span>
      <div id="rbg">
        <RadioButtonGroup value={plan} name="plan" layout="grid">
          <Label>Plan</Label>
          <RadioButtonGroup.Item value="solo">
            <RadioButtonGroup.Indicator />
            <RadioButtonGroup.ItemContent>
              <Label>Solo</Label>
              <Description>One seat</Description>
            </RadioButtonGroup.ItemContent>
          </RadioButtonGroup.Item>
          <RadioButtonGroup.Item value="team">
            <RadioButtonGroup.Indicator />
            <RadioButtonGroup.ItemContent>
              <Label>Team</Label>
              <Description>Up to ten seats</Description>
            </RadioButtonGroup.ItemContent>
          </RadioButtonGroup.Item>
          <RadioButtonGroup.Item value="org" isDisabled>
            <RadioButtonGroup.Indicator />
            <RadioButtonGroup.ItemContent>
              <Label>Organization</Label>
            </RadioButtonGroup.ItemContent>
          </RadioButtonGroup.Item>
        </RadioButtonGroup>
      </div>
      <span id="rbg-state">{String(plan())}</span>
      <div id="cbg">
        <CheckboxButtonGroup value={extras} name="extras">
          <Label>Extras</Label>
          <CheckboxButtonGroup.Item value="backup">
            <CheckboxButtonGroup.Indicator />
            <CheckboxButtonGroup.ItemContent>
              <Label>Backups</Label>
            </CheckboxButtonGroup.ItemContent>
          </CheckboxButtonGroup.Item>
          <CheckboxButtonGroup.Item value="sso">
            <CheckboxButtonGroup.Indicator />
            <CheckboxButtonGroup.ItemContent>
              <Label>SSO</Label>
            </CheckboxButtonGroup.ItemContent>
          </CheckboxButtonGroup.Item>
        </CheckboxButtonGroup>
      </div>
      <span id="cbg-state">{extras().join(",")}</span>
      <div id="nst">
        <NumberStepper value={guests} minValue={0} maxValue={10}>
          <Label>Guests</Label>
          <NumberStepper.Group>
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper.Group>
        </NumberStepper>
      </div>
      <span id="nst-state">{String(guests())}</span>
      <div id="csl">
        <CellSlider value={volume} step={10}>
          <CellSlider.Track>
            <CellSlider.Fill />
            <CellSlider.Thumb />
          </CellSlider.Track>
          <CellSlider.Label>Volume</CellSlider.Label>
          <CellSlider.Output />
        </CellSlider>
      </div>
      <span id="csl-state">{String(volume())}</span>
      <div id="csel">
        <CellSelect value={theme}>
          <CellSelect.Trigger>
            <CellSelect.Label>Theme</CellSelect.Label>
            <CellSelect.Value />
            <CellSelect.Indicator />
          </CellSelect.Trigger>
          <CellSelect.Popover>
            <ListBox>
              <ListBox.Item id="light" textValue="Light">
                Light
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="dark" textValue="Dark">
                Dark
                <ListBox.ItemIndicator />
              </ListBox.Item>
              <ListBox.Item id="system" textValue="System">
                System
                <ListBox.ItemIndicator />
              </ListBox.Item>
            </ListBox>
          </CellSelect.Popover>
        </CellSelect>
      </div>
      <span id="csel-state">{String(theme())}</span>
      <div id="isel">
        <Breadcrumbs>
          <Breadcrumbs.Item href="#home">Acme</Breadcrumbs.Item>
          <Breadcrumbs.Item>
            {({ separator }) => (
              <>
                <InlineSelect value={project} aria-label="Project">
                  <InlineSelect.Trigger>
                    <InlineSelect.Value />
                    <InlineSelect.Indicator />
                  </InlineSelect.Trigger>
                  <InlineSelect.Popover>
                    <ListBox>
                      <ListBox.Item id="web" textValue="Website">
                        Website
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                      <ListBox.Item id="app" textValue="Mobile app">
                        Mobile app
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    </ListBox>
                  </InlineSelect.Popover>
                </InlineSelect>
                {separator()}
              </>
            )}
          </Breadcrumbs.Item>
          <Breadcrumbs.Item>Settings</Breadcrumbs.Item>
        </Breadcrumbs>
      </div>
      <span id="isel-state">{String(project())}</span>
      <RadioButtonGroup
        id="sh-rbg"
        value={size}
        name="sh-size"
        label="Workspace size"
        items={[
          { value: "s", label: "Small", description: "Up to 5 people" },
          { value: "l", label: "Large", description: "Unlimited" },
        ]}
      />
      <span id="sh-rbg-state">{size()}</span>
      <CheckboxButtonGroup
        id="sh-cbg"
        value={channels}
        label="Notifications"
        items={[
          { value: "email", label: "Email" },
          { value: "sms", label: "SMS", description: "Only urgent" },
        ]}
      />
      <span id="sh-cbg-state">{channels().join(",")}</span>
      <div id="sh-csel" class="w-80">
        <CellSelect label="Density" value={density}>
          <CellSelect.Item id="compact">Compact</CellSelect.Item>
          <CellSelect.Item id="comfortable">Comfortable</CellSelect.Item>
        </CellSelect>
      </div>
      <span id="sh-csel-state">{String(density())}</span>
      <p id="sh-isel">
        Every{" "}
        <InlineSelect aria-label="Cadence" value={cadence} items={cadences}>
          {(item: { id: string; name: string }) => <InlineSelect.Item id={item.id}>{item.name}</InlineSelect.Item>}
        </InlineSelect>
      </p>
      <span id="sh-isel-state">{String(cadence())}</span>
      <div id="sh-csl" class="w-80">
        <CellSlider label="Opacity" value={opacity} step={10} />
      </div>
      <span id="sh-csl-state">{opacity()}</span>
    </section>
  );
}
