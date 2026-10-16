import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { FieldError, Form } from "@rivetjs/cdk/form";
import { Switch, SwitchButton, SwitchField } from "@rivetjs/cdk/switch";
import { Text } from "@rivetjs/cdk/text";

export const head = { title: "Switch in a form" };

// #region demo
const button = "group flex cursor-pointer items-center gap-3";
const track =
  "relative h-6 w-11 rounded-full bg-slate-300 transition group-data-[selected]:bg-teal-700 " +
  "group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-teal-500 group-data-[focus-visible]:ring-offset-2 " +
  "after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition " +
  "group-data-[selected]:after:translate-x-5";

export default function Settings() {
  const result = signal("not saved");
  return (
    <Form
      class="m-4 grid max-w-md justify-items-start gap-3 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget as HTMLFormElement);
        result.set(`two-factor=${data.get("two-factor")} theme=${data.get("theme")}`);
      }}
    >
      {() => (
        <>
          {/* SwitchField: validation, a description and an error message. */}
          <SwitchField
            id="sw-2fa"
            name="two-factor"
            isRequired
            class="grid gap-1 [&_.rv-Text]:text-xs [&_.rv-Text]:text-slate-500 [&_.rv-FieldError]:text-red-700"
          >
            <SwitchButton class={button}>
              <span class={track} aria-hidden="true" />
              Two-factor authentication
            </SwitchButton>
            <Text slot="description">Your organisation requires two-factor authentication.</Text>
            <FieldError />
          </SwitchField>
          {/* Switch: submits name=value while on (value defaults to "on"). */}
          <Switch id="sw-dark" name="theme" value="dark" class={button}>
            <span class={track} aria-hidden="true" />
            Dark theme
          </Switch>
          <Button id="sw-save" type="submit">
            Save
          </Button>
          <output id="sw-result">{result()}</output>
        </>
      )}
    </Form>
  );
}
// #endregion
