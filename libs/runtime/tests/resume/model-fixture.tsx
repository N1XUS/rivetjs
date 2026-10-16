import { signal } from "@rivetjs/reactivity";

// model: inside a component rendered in a region: typing must not re-create the component.
function Field(props: { label: string }) {
  const text = signal("hi");
  const agree = signal(false);
  const count = signal(0);
  return (
    <div>
      <label>{props.label}</label>
      <input id="text" model:value={text} />
      <input id="agree" type="checkbox" model:checked={agree} />
      <button id="inc" onClick={() => count.set(count() + 1)}>{count()}</button>
      <output id="out">{text()}</output>
      <output id="agreed">{agree() ? "yes" : "no"}</output>
      <button id="reset" onClick={() => { text.set("reset"); agree.set(false); }}>reset</button>
    </div>
  );
}

export function Models() {
  return (
    <main>
      <Field label="Name" />
    </main>
  );
}
