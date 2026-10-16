import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { SearchField } from "@rivetjs/cdk/search-field";
import { X } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "SearchField: events" };

// #region demo
export default function Events() {
  const log = signal<string[]>([]);
  const add = (entry: string) => log.update((l) => [...l.slice(-5), entry]);
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <SearchField
        id="q"
        class="grid gap-1"
        onChange={(value) => add("change: " + value)}
        onSubmit={(value) => add("submit: " + value)}
        onClear={() => add("clear")}
        onFocusChange={(isFocused) => add("focus: " + isFocused)}
      >
        <Label>Search</Label>
        <div class="flex rounded-md border border-slate-300">
          <Input class="min-w-0 flex-1 px-3 py-2 outline-none" />
          <Button class="px-2 text-slate-500">
            <Icon icon={X} />
          </Button>
        </div>
      </SearchField>
      <output id="log" class="text-slate-600">
        {log().join(" | ")}
      </output>
    </div>
  );
}
// #endregion
