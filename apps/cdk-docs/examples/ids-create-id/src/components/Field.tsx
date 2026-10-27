import { resumedId } from "@rivetjs/cdk/id";

// #region demo
/** A labelled input with a hint: resumedId() ties label, input and hint together. */
export function Field(props: { label: string; hint: string; name: string }) {
  const id = resumedId();
  return (
    <div class="grid gap-1" data-field={props.name}>
      <label for={id} class="font-semibold">
        {props.label}
      </label>
      <input id={id} name={props.name} aria-describedby={id + "-hint"} class="rounded border border-slate-300 px-2 py-1" />
      <p id={id + "-hint"} class="text-slate-600">
        {props.hint} <code class="text-xs">id="{id}"</code>
      </p>
    </div>
  );
}
// #endregion
