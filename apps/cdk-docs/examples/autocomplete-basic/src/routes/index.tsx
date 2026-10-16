import { Autocomplete } from "@rivetjs/cdk/autocomplete";
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { ListBox } from "@rivetjs/cdk/listbox";
import { Button } from "@rivetjs/cdk/button";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { SearchField } from "@rivetjs/cdk/search-field";
import { X } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Autocomplete" };

const commands = [
  { id: "new", name: "New file" },
  { id: "open", name: "Open file" },
  { id: "save", name: "Save" },
  { id: "close", name: "Close window" },
];
const { contains } = createFilter({ sensitivity: "base" }, "en-US");

// #region demo
export default function Commands() {
  return (
    <div class="m-4 grid max-w-sm gap-2 text-sm">
      <Autocomplete filter={(textValue, inputValue) => contains(textValue, inputValue)}>
        <SearchField id="cmd" class="grid gap-1">
          <Label>Command</Label>
          <div class="flex rounded-md border border-slate-300">
            <Input class="min-w-0 flex-1 px-3 py-2 outline-none" />
            <Button class="px-2 text-slate-500">
              <Icon icon={X} />
            </Button>
          </div>
        </SearchField>
        <ListBox id="cmds" aria-label="Commands" items={commands} class="rounded-md border border-slate-200 p-1" />
      </Autocomplete>
    </div>
  );
}
// #endregion
