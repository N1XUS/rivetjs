import { signal } from "@rivetjs/reactivity";
import { Autocomplete } from "@rivetjs/cdk/autocomplete";
import { createFilter } from "@rivetjs/cdk/i18n/filter";
import { Menu, MenuItem } from "@rivetjs/cdk/menu";
import { Input } from "@rivetjs/cdk/input";
import { SearchField } from "@rivetjs/cdk/search-field";

export const head = { title: "Autocomplete: filter" };

const { startsWith } = createFilter({ sensitivity: "base" }, "en-US");

// #region demo
export default function Filter() {
  const query = signal("");
  return (
    <div class="m-4 grid max-w-sm gap-2 text-sm">
      <Autocomplete inputValue={query} filter={(textValue, inputValue) => startsWith(textValue, inputValue)}>
        <SearchField id="q" aria-label="Commands" class="rounded-md border border-slate-300">
          <Input placeholder="Type a command" class="w-full px-3 py-2 outline-none" />
        </SearchField>
        <Menu aria-label="Commands" class="rounded-md border border-slate-200 p-1">
          <MenuItem id="save">Save</MenuItem>
          <MenuItem id="split">Split editor</MenuItem>
          <MenuItem id="close">Close window</MenuItem>
          <MenuItem id="open">Open file</MenuItem>
        </Menu>
      </Autocomplete>
      <p id="query" class="text-slate-600">
        Query: {query()}
      </p>
      <button id="preset" type="button" class="justify-self-start rounded border px-2 py-1" onClick={() => query.set("cl")}>
        Search "cl"
      </button>
    </div>
  );
}
// #endregion
