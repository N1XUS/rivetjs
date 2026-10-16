import { Button } from "@rivetjs/cdk/button";
import { FieldError, Form } from "@rivetjs/cdk/form";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { SearchField } from "@rivetjs/cdk/search-field";
import { Text } from "@rivetjs/cdk/text";
import { X } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "SearchField: validation" };

const field = "grid gap-1 data-[disabled]:opacity-50";
const box = "flex rounded-md border border-slate-300 in-data-[invalid]:border-red-600";
const input = "min-w-0 flex-1 px-3 py-2 outline-none";

// #region demo
export default function Validation() {
  return (
    <Form class="m-4 grid max-w-sm gap-4 text-sm" onSubmit={(event) => event.preventDefault()}>
      {() => (
        <>
          <SearchField id="q" name="q" isRequired minLength={2} class={field}>
            <Label>Search</Label>
            <div class={box}>
              <Input class={input} />
              <Button class="px-2 text-slate-500">
                <Icon icon={X} />
              </Button>
            </div>
            <Text slot="description" class="text-slate-500">
              At least 2 characters.
            </Text>
            <FieldError id="q-error" class="text-red-700" />
          </SearchField>
          <SearchField id="off" isDisabled defaultValue="Disabled" class={field}>
            <Label>Archive</Label>
            <div class={box}>
              <Input class={input} />
              <Button class="px-2 text-slate-500">
                <Icon icon={X} />
              </Button>
            </div>
          </SearchField>
          <button id="go" type="submit" class="justify-self-start rounded border px-3 py-1">
            Search
          </button>
        </>
      )}
    </Form>
  );
}
// #endregion
