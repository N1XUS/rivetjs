// Field text size (TWEAKS.md TW-195, `text-field` utility): one of every editable control, each inside a
// `data-field-scope` (or carrying `data-field`) naming it. `field-text.test.ts` reads the computed font size on fine vs coarse pointers.
import { signal } from "@rivetjs/reactivity";
import { ColorField } from "@rivetjs/ui/color-field";
import { ComboBox } from "@rivetjs/ui/combo-box";
import { DateField } from "@rivetjs/ui/date-field";
import { Input } from "@rivetjs/ui/input";
import { InputGroup } from "@rivetjs/ui/input-group";
import { Label } from "@rivetjs/ui/label";
import { ListBox } from "@rivetjs/ui/list-box";
import { NativeSelect } from "@rivetjs/ui/native-select";
import { NumberField } from "@rivetjs/ui/number-field";
import { NumberStepper } from "@rivetjs/ui/number-stepper";
import { PromptInput } from "@rivetjs/ui/prompt-input";
import {
  PromptInputTokenInput,
  PromptInputTokens,
  PromptInputTokenSuggestion,
  PromptInputTokenSuggestions,
  usePromptInputTokens,
} from "@rivetjs/ui/prompt-input-tokens";
import { SearchField } from "@rivetjs/ui/search-field";
import { TextArea } from "@rivetjs/ui/textarea";
import { TextField } from "@rivetjs/ui/textfield";

export default function FieldTextStories() {
  const color = signal<string | null>("#0485F7");
  const tokens = usePromptInputTokens({ triggers: ["@"] });
  return (
    <section class="flex w-[34rem] flex-col gap-6 p-10">
      <TextField>
        <Label>Name</Label>
        <Input data-field="input" />
      </TextField>
      <TextArea aria-label="Notes" data-field="textarea" />
      <InputGroup>
        <InputGroup.Input aria-label="Group" data-field="input-group" />
      </InputGroup>
      <SearchField aria-label="Search">
        <SearchField.Group>
          <SearchField.Input data-field="search-field" />
        </SearchField.Group>
      </SearchField>
      <NumberField aria-label="Amount" defaultValue={1}>
        <NumberField.Group>
          <NumberField.Input data-field="number-field" />
        </NumberField.Group>
      </NumberField>
      <div data-field-scope="number-stepper">
        <NumberStepper aria-label="Quantity" defaultValue={1}>
          <NumberStepper.Group>
            <NumberStepper.DecrementButton />
            <NumberStepper.Value />
            <NumberStepper.IncrementButton />
          </NumberStepper.Group>
        </NumberStepper>
      </div>
      <div data-field-scope="native-select">
        <NativeSelect
          label="Tea"
          items={[
            { value: "green", label: "Green" },
            { value: "black", label: "Black" },
          ]}
        />
      </div>
      <div data-field-scope="date-field">
        <DateField aria-label="Date">
          <DateField.Group>
            <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
          </DateField.Group>
        </DateField>
      </div>
      <div data-field-scope="color-field">
        <ColorField aria-label="Color" value={color}>
          <ColorField.Group>
            <ColorField.Input />
          </ColorField.Group>
        </ColorField>
      </div>
      <div data-field-scope="combo-box">
        <ComboBox aria-label="Animal">
          <ComboBox.InputGroup>
            <Input />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          <ComboBox.Popover>
            <ListBox>
              <ListBox.Item id="cat">Cat</ListBox.Item>
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>
      </div>
      <div data-field-scope="prompt-input">
        <PromptInput aria-label="Prompt">
          <PromptInput.Shell>
            <PromptInput.Content>
              <PromptInput.TextArea />
            </PromptInput.Content>
          </PromptInput.Shell>
        </PromptInput>
      </div>
      <div data-field-scope="prompt-input-tokens">
        <PromptInput aria-label="Mention">
          <PromptInput.Shell>
            <PromptInputTokens tokens={tokens}>
              <PromptInput.Content>
                <PromptInputTokenInput />
              </PromptInput.Content>
              <PromptInputTokenSuggestions aria-label="People">
                <PromptInputTokenSuggestion id="ana" token="@ana">
                  Ana
                </PromptInputTokenSuggestion>
              </PromptInputTokenSuggestions>
            </PromptInputTokens>
          </PromptInput.Shell>
        </PromptInput>
      </div>
    </section>
  );
}
