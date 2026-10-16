import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Input } from "@rivetjs/cdk/input";
import { Label } from "@rivetjs/cdk/label";
import { Text } from "@rivetjs/cdk/text";
import { TextField } from "@rivetjs/cdk/text-field";

export const head = { title: "Controlled and uncontrolled TextField" };

const input = "rounded-md border border-slate-300 px-3 py-1.5 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/30";

// #region demo
export default function Profile() {
  const name = signal("");
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      {/* Controlled: typing writes the signal; writing the signal updates the input. */}
      <TextField id="name" value={name} class="grid gap-1">
        <Label class="font-medium">Name</Label>
        <Input class={input} />
        <Text slot="description" class="text-xs text-slate-500">
          As on your passport.
        </Text>
      </TextField>
      <Button id="clear-name" class="justify-self-start rounded-md border border-slate-300 px-3 py-1" onPress={() => name.set("")}>
        Clear
      </Button>
      <p id="greeting">Hello, {name() || "stranger"}!</p>
      {/* Uncontrolled: starts from defaultValue (also the value a form reset restores). */}
      <TextField id="city" defaultValue="Lisbon" class="grid gap-1">
        <Label class="font-medium">City</Label>
        <Input class={input} />
      </TextField>
    </section>
  );
}
// #endregion
