import { signal } from "@rivetjs/reactivity";
import { Autocomplete } from "@rivetjs/cdk/autocomplete";
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { Menu, MenuItem } from "@rivetjs/cdk/menu";
import { Button } from "@rivetjs/cdk/button";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { SearchField } from "@rivetjs/cdk/search-field";
import { X } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Autocomplete: command palette" };

const { contains } = createFilter({ sensitivity: "base" }, "en-US");

// #region demo
export default function Palette() {
  const ran = signal("");
  return (
    <div class="m-4 grid max-w-sm gap-2 text-sm">
      <Autocomplete filter={(textValue, inputValue) => contains(textValue, inputValue)}>
        <SearchField id="palette" aria-label="Commands" class="flex rounded-md border border-slate-300">
          <Input placeholder="Type a command" class="min-w-0 flex-1 px-3 py-2 outline-none" />
          <Button class="px-2 text-slate-500">
            <Icon icon={X} />
          </Button>
        </SearchField>
        <Menu aria-label="Commands" class="rounded-md border border-slate-200 p-1" onAction={(key) => ran.set(String(key))}>
          <MenuItem id="new">New file</MenuItem>
          <MenuItem id="open">Open file</MenuItem>
          <MenuItem id="save">Save</MenuItem>
          <MenuItem id="close">Close window</MenuItem>
        </Menu>
      </Autocomplete>
      <p id="ran" class="text-slate-600">
        Ran: {ran()}
      </p>
    </div>
  );
}
// #endregion
