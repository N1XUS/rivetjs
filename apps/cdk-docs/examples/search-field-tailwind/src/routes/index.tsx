import { Button } from "@rivetjs/cdk/button";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { SearchField } from "@rivetjs/cdk/search-field";
import { Search, X } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "SearchField: Tailwind" };

// #region demo
export default function Tailwind() {
  return (
    <div class="m-4 max-w-sm text-sm">
      {/* A class function of the render props (accessors), here adding "is-empty". */}
      <SearchField id="q" class={({ isEmpty }) => "group grid gap-1" + (isEmpty() ? " is-empty" : "")}>
        <Label class="font-medium text-slate-700">Search</Label>
        <div class="flex items-center gap-1 rounded-md border border-slate-300 px-2 focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/30">
          <Icon icon={Search} class="text-slate-400" />
          <Input placeholder="Search components" class="min-w-0 flex-1 px-1 py-2 outline-none [&::-webkit-search-cancel-button]:hidden" />
          <Button class="rounded p-1 text-slate-500 group-data-[empty]:invisible data-[pressed]:bg-slate-100">
            <Icon icon={X} />
          </Button>
        </div>
      </SearchField>
    </div>
  );
}
// #endregion
