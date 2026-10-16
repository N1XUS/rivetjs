// Component-props scenario (Rivet lane). Same tree as solid.jsx; see README "Props suite".
import { signal, batch } from "@rivetjs/reactivity";
import { For } from "@rivetjs/runtime/dom";
import { mergeProps, splitProps } from "@rivetjs/runtime/props";

const rows = signal([]),
  selected = signal(-1);

function Label(props) {
  return <span class={props.tone}>{props.text}</span>;
}
// Defaults (mergeProps) + split (splitProps) + DOM spread of the rest.
function Badge(props) {
  const merged = mergeProps({ size: "md", tone: "neutral" }, props);
  const [local, rest] = splitProps(merged, ["size", "tone", "count"]);
  return (
    <b {...rest} class={local.size + " " + local.tone}>
      {local.count}
    </b>
  );
}
function Cell(props) {
  return (
    <td class={props.cls}>
      <Label text={props.text} tone={props.tone} />
    </td>
  );
}
function Row(props) {
  return (
    <tr class={props.selected ? "danger" : ""}>
      <Cell cls="id" text={props.row.id} tone="muted" />
      <Cell cls="label" text={props.row.label()} tone={props.selected ? "hot" : "cold"} />
      <td>
        <Badge {...props.badge} count={props.row.count()} title={props.row.label()} />
      </td>
    </tr>
  );
}
function Table() {
  return (
    <table>
      <tbody>
        <For each={rows()}>
          {(item) => {
            // Rivet rows get an item accessor (Solid: the item); rows never change identity here.
            const row = item();
            return <Row row={row} selected={selected() === row.id} badge={{ "data-kind": "b", size: "sm" }} />;
          }}
        </For>
      </tbody>
    </table>
  );
}
const wrap = (d) => ({ id: d.id, label: signal(d.label), count: signal(d.count) });
export const app = {
  table: () => <Table />,
  load: (data) => rows.set(data.map(wrap)),
  clear: () => {
    rows.set([]);
    selected.set(-1);
  },
  relabel: (suffix) => batch(() => rows().forEach((r) => r.label.set(r.label() + suffix))),
  select: (id) => selected.set(id),
  bump: (stride) => batch(() => rows().forEach((r, i) => i % stride === 0 && r.count.set(r.count() + 1))),
};
