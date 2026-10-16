import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { SearchField } from "@rivetjs/cdk/search-field";
import { X } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "SearchField" };

// #region demo
export default function Search() {
  const submitted = signal("");
  return (
    <div class="m-4 grid max-w-sm gap-3 text-sm">
      <SearchField id="q" onSubmit={(value) => submitted.set(value)} class="grid gap-1">
        <Label>Search</Label>
        <div class="flex rounded-md border border-slate-300">
          <Input placeholder="Search docs" class="min-w-0 flex-1 px-3 py-2 outline-none" />
          <Button class="px-2 text-slate-500 [[data-empty]_&]:hidden">
            <Icon icon={X} />
          </Button>
        </div>
      </SearchField>
      <p id="submitted">Submitted: {submitted()}</p>
    </div>
  );
}
// #endregion
