// Toggle components on a resumed page (P3-FORMS lane; upstream keyboard / focus-visible / hover cases that need a real browser):
// `#before` button (Tab start), `#cb` Checkbox (input `#cb-input` via `id` on the field root → the input; state `#cb-state`), `#cbg` CheckboxGroup (two-way value →
// `#cbg-state`), `#rg` RadioGroup (`#rg-a` / `#rg-b`, value → `#rg-state`), `#sw` Switch (state `#sw-state`), disabled Switch `#sw-off`.
// Shorthand (UI identity T21): `#sh-cb` Checkbox `label` + `description` (→ `#sh-cb-state`), `#sh-cbg` CheckboxGroup `label` +
// `description` + `items` (→ `#sh-cbg-state`), `#sh-rg` RadioGroup `items` (→ `#sh-rg-state`), `#sh-sw` Switch `label` (→ `#sh-sw-state`).
import { signal } from "@rivetjs/reactivity";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { CheckboxGroup } from "@rivetjs/ui/checkbox-group";
import { Label } from "@rivetjs/ui/label";
import { Radio } from "@rivetjs/ui/radio";
import { RadioGroup } from "@rivetjs/ui/radio-group";
import { Switch } from "@rivetjs/ui/switch";
import { SwitchGroup } from "@rivetjs/ui/switch-group";

export default function ToggleStories() {
  const terms = signal(false);
  const picks = signal<string[]>([]);
  const plan = signal<string | null>("a");
  const notify = signal(false);
  const news = signal(false);
  const topics = signal<string[]>([]);
  const tier = signal<string | null>("free");
  const dark = signal(false);
  return (
    <section class="flex flex-col gap-8 p-10">
      <button id="before" type="button">
        Before
      </button>
      <Checkbox data-testid="cb" id="cb-input" isSelected={terms}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Label>Accept terms</Label>
        </Checkbox.Content>
      </Checkbox>
      <span id="cb-state">{terms() ? "on" : "off"}</span>
      <CheckboxGroup data-testid="cbg" name="interests" value={picks}>
        <Label>Interests</Label>
        <Checkbox id="cbg-coding" value="coding">
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Coding
          </Checkbox.Content>
        </Checkbox>
        <Checkbox id="cbg-design" value="design">
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            Design
          </Checkbox.Content>
        </Checkbox>
      </CheckboxGroup>
      <span id="cbg-state">{picks().join(",")}</span>
      <RadioGroup data-testid="rg" name="plan" value={plan}>
        <Label>Plan</Label>
        <Radio id="rg-a" value="a">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Basic
          </Radio.Content>
        </Radio>
        <Radio id="rg-b" value="b">
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            Premium
          </Radio.Content>
        </Radio>
      </RadioGroup>
      <span id="rg-state">{plan()}</span>
      <SwitchGroup>
        <Switch data-testid="sw" id="sw-input" isSelected={notify}>
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Label>Enable notifications</Label>
          </Switch.Content>
        </Switch>
        <Switch isDisabled data-testid="sw-off" id="sw-off-input">
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            Disabled
          </Switch.Content>
        </Switch>
      </SwitchGroup>
      <span id="sw-state">{notify() ? "on" : "off"}</span>
      <Checkbox data-testid="sh-cb" id="sh-cb-input" isSelected={news} label="Newsletter" description="Once a month" />
      <span id="sh-cb-state">{news() ? "on" : "off"}</span>
      <CheckboxGroup
        data-testid="sh-cbg"
        name="topics"
        value={topics}
        label="Topics"
        description="Pick any"
        items={[
          { value: "rust", label: "Rust" },
          { value: "wasm", label: "Wasm", description: "WebAssembly" },
          { value: "ssr", label: "SSR", isDisabled: true },
        ]}
      />
      <span id="sh-cbg-state">{topics().join(",")}</span>
      <RadioGroup
        data-testid="sh-rg"
        name="tier"
        value={tier}
        label="Tier"
        items={[
          { value: "free", label: "Free" },
          { value: "pro", label: "Pro", description: "For teams" },
        ]}
      />
      <span id="sh-rg-state">{tier()}</span>
      <Switch data-testid="sh-sw" id="sh-sw-input" isSelected={dark} label="Dark mode" />
      <span id="sh-sw-state">{dark() ? "on" : "off"}</span>
    </section>
  );
}
