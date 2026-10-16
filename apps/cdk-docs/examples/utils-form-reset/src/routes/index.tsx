import { signal } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import { useFormReset } from "@rivetjs/cdk/utils";

export const head = { title: "useFormReset()" };

// #region demo
export default function Profile() {
  const name = signal("Ada");
  const resets = signal(0);
  let input!: HTMLInputElement;
  // A reset of the field's form (unless cancelled) calls onReset with the initial value.
  clientEffect(() =>
    useFormReset(input, "Ada", (initial) => {
      name.set(initial);
      resets.update((n) => n + 1);
    }),
  );
  return (
    <form class="m-4 grid max-w-sm gap-2 text-sm" onSubmit={(event) => event.preventDefault()}>
      <label class="grid gap-1">
        Name
        <input
          id="name"
          ref={(el) => (input = el)}
          name="name"
          class="rounded border border-slate-300 px-2 py-1"
          value={name()}
          onInput={(event) => name.set(event.currentTarget.value)}
        />
      </label>
      <p id="preview">Hello, {name()}!</p>
      <p id="resets">Resets: {resets()}</p>
      <button id="reset" type="reset" class="justify-self-start rounded-md border border-slate-300 px-3 py-1">
        Reset
      </button>
    </form>
  );
}
// #endregion
