import { signal } from "@rivetjs/reactivity";
import { Autocomplete } from "@rivetjs/cdk/autocomplete";
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { ListBox } from "@rivetjs/cdk/listbox";
import { Button } from "@rivetjs/cdk/button";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { SearchField } from "@rivetjs/cdk/search-field";

export const head = { title: "Autocomplete" };

const commands = [
  { id: "new", name: "New file" },
  { id: "open", name: "Open file" },
  { id: "save", name: "Save" },
  { id: "close", name: "Close window" },
];
const { contains } = createFilter({ sensitivity: "base" }, "en-US");

export default function AutocompleteStory() {
  const action = signal("");
  return (
    <section>
      <h1>Autocomplete</h1>
      {/* SearchField + ListBox wrapped in Autocomplete (docs example autocomplete-basic): resumed filtering + virtual focus. */}
      <Autocomplete filter={(textValue, inputValue) => contains(textValue, inputValue)}>
        <SearchField id="ac-field">
          <Label>Command</Label>
          <Input id="ac-input" />
          <Button>Clear</Button>
        </SearchField>
        <ListBox id="ac-list" aria-label="Commands" items={commands} onAction={(key) => action.set(String(key))} />
      </Autocomplete>
      <output id="ac-action">{action()}</output>
    </section>
  );
}
