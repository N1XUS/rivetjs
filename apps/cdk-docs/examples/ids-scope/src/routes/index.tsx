import { createId, useId, withIdScope } from "@rivetjs/cdk/id";

export const head = { title: "withIdScope and useId" };

function Checkbox(props: { id?: string; label: string; hint: string }) {
  // useId: the caller's id when given, else a new one.
  const id = useId(props.id);
  const hintId = createId();
  return (
    <div class="flex items-center gap-2">
      <input type="checkbox" id={id} aria-describedby={hintId} />
      <label for={id}>{props.label}</label>
      <span id={hintId} class="text-slate-500">
        {props.hint}
      </span>
    </div>
  );
}

// #region demo
export default function Settings() {
  return (
    <section class="m-4 grid gap-2 text-sm">
      {/* Inside the scope the ids are card-0, card-1, … on every render. */}
      <div id="scoped">
        {withIdScope("card-", () => (
          <Checkbox label="Remember me" hint="For 30 days" />
        ))}
      </div>
      <div id="explicit">
        <Checkbox id="newsletter" label="Newsletter" hint="Monthly" />
      </div>
      <div id="generated">
        <Checkbox label="Beta features" hint="May break" />
      </div>
    </section>
  );
}
// #endregion
