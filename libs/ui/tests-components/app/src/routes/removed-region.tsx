// Removed server regions bound to a shared signal (showcase-auth repro, `../../../removed-region.test.ts`): the server step holds a
// TextField bound to `email`; a step change removes it (`#t-*`: JSX ternary, `#k-*`: `<Show keyed>`) and the browser creates a step that
// binds `email` too. `#w-*`: a Label wrapped in a `<div>` inside a TextField next to a conditional sibling (no removal).
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Button } from "@rivetjs/ui/button";
import { Input } from "@rivetjs/ui/input";
import { Label } from "@rivetjs/ui/label";
import { TextField } from "@rivetjs/ui/textfield";

export default function RemovedRegion() {
  const tStep = signal("form");
  const tEmail = signal("");
  const kStep = signal("form");
  const kEmail = signal("");
  const wEmail = signal("");
  const wHint = signal(false);
  return (
    <section class="flex flex-col gap-8 p-10">
      <div id="t">
        {tStep() === "form" ? (
          <TextField id="t-email" name="email" value={tEmail}>
            <Label>Email</Label>
            <Input id="t-input" />
          </TextField>
        ) : (
          <TextField id="t-code" name="code" value={tEmail}>
            <Label>Sent to</Label>
            <Input id="t-code-input" />
          </TextField>
        )}
        <Button id="t-go" onPress={() => tStep.set(tStep() === "form" ? "code" : "form")}>
          Go
        </Button>
        <Button id="t-type" onPress={() => tEmail.set(tEmail() + "x")}>
          Type
        </Button>
        <span id="t-state">{tEmail()}</span>
      </div>

      <div id="k">
        <Show when={kStep} keyed>
          {(step: () => string) =>
            step() === "form" ? (
              <TextField id="k-email" name="email" value={kEmail}>
                <Label>Email</Label>
                <Input id="k-input" />
              </TextField>
            ) : (
              <TextField id="k-code" name="code" value={kEmail}>
                <Label>Sent to</Label>
                <Input id="k-code-input" />
              </TextField>
            )
          }
        </Show>
        <Button id="k-go" onPress={() => kStep.set(kStep() === "form" ? "code" : "form")}>
          Go
        </Button>
        <Button id="k-type" onPress={() => kEmail.set(kEmail() + "x")}>
          Type
        </Button>
      </div>

      <div id="w">
        <TextField id="w-email" name="email" value={wEmail}>
          <div class="flex gap-2">
            <Label>Email</Label>
          </div>
          {wHint() ? <span id="w-hint">Hint</span> : null}
          <Input id="w-input" />
        </TextField>
        <Button id="w-hint-toggle" onPress={() => wHint.set(!wHint())}>
          Hint
        </Button>
        <Button id="w-type" onPress={() => wEmail.set(wEmail() + "x")}>
          Type
        </Button>
      </div>
    </section>
  );
}
