import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Form } from "@rivetjs/cdk/form";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { Switch } from "@rivetjs/cdk/switch";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "Form submit and reset" };

// #region demo
export default function Profile() {
  const log = signal<string[]>([]);
  const name = signal("Ada");
  const news = signal(false);
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <Form
        id="profile"
        aria-label="Profile"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget as HTMLFormElement);
          log.update((l) => [...l, `submit:name=${data.get("name")},news=${data.get("news") ?? "off"}`]);
        }}
        onReset={() => log.update((l) => [...l, "reset"])}
      >
        <div class="grid gap-3">
          {/* A reset restores defaultValue / defaultSelected (or the first value). */}
          <TextField id="pf-name" name="name" value={name} isRequired class="grid gap-1">
            <Label>Name</Label>
            <Input class="rounded-md border border-slate-300 px-3 py-1.5" />
          </TextField>
          <Switch id="pf-news" name="news" isSelected={news}>
            Newsletter
          </Switch>
          <div class="flex gap-2">
            <Button id="pf-save" type="submit" class="rounded-md bg-teal-700 px-3 py-1.5 text-white">
              Save
            </Button>
            <Button id="pf-reset" type="reset" class="rounded-md border border-slate-300 px-3 py-1.5">
              Reset
            </Button>
          </div>
        </div>
      </Form>
      <p id="pf-state">
        {name()} / news {news() ? "on" : "off"}
      </p>
      <output id="pf-log" class="font-mono text-xs text-slate-600">
        {log().join(" ")}
      </output>
    </section>
  );
}
// #endregion
