// Spacing, hit targets and density (identity spec §3.2, TWEAKS.md TW-136…TW-139). Read by `spacing.test.ts`:
// small controls without label text (`[data-testid=t-*]`, `#t-close`: hit area ≥ 24 px on fine pointers, ≥ 44 px on coarse pointers) and the
// same Button / Input / ListBox in a default (`#d-default`) and a `data-density="compact"` (`#d-compact`) block, with a
// nested `data-density="comfortable"` (`#d-restored`).
import { Button } from "@rivetjs/ui/button";
import { Checkbox } from "@rivetjs/ui/checkbox";
import { CloseButton } from "@rivetjs/ui/close-button";
import { Input } from "@rivetjs/ui/input";
import { ListBox } from "@rivetjs/ui/list-box";
import { Radio } from "@rivetjs/ui/radio";
import { RadioGroup } from "@rivetjs/ui/radio-group";
import { Switch } from "@rivetjs/ui/switch";

function Controls(props: { id: string }) {
  return (
    <div id={props.id} class="flex flex-col items-start gap-4">
      <Button class="d-md">Medium</Button>
      <Button class="d-sm" size="sm">
        Small
      </Button>
      <Button class="d-lg" size="lg">
        Large
      </Button>
      <Input class="d-input" aria-label="Name" placeholder="Name" />
      <ListBox aria-label="Fruit" class="w-48">
        <ListBox.Item id="apple" textValue="Apple">
          Apple
        </ListBox.Item>
      </ListBox>
    </div>
  );
}

export default function SpacingStories() {
  return (
    <section class="flex flex-wrap items-start gap-16 p-10">
      <div class="flex flex-col items-start gap-10">
        <Checkbox data-testid="t-checkbox" aria-label="Accept">
          <Checkbox.Content>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
          </Checkbox.Content>
        </Checkbox>
        <RadioGroup aria-label="Plan" defaultValue="a">
          <Radio data-testid="t-radio" value="a" aria-label="Basic">
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
            </Radio.Content>
          </Radio>
        </RadioGroup>
        <Switch data-testid="t-switch" aria-label="Notify">
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
        <CloseButton id="t-close" />
      </div>
      <Controls id="d-default" />
      <div data-density="compact">
        <Controls id="d-compact" />
        <div data-density="comfortable">
          <Controls id="d-restored" />
        </div>
      </div>
    </section>
  );
}
