// Component-props scenario (Solid stable lane). Same tree as rivet.jsx.
import { createSignal, batch, For, mergeProps, splitProps } from "solid-js";

const [rows, setRows] = createSignal([]),
  [selected, setSelected] = createSignal(-1);

function Label(props) {
  return <span class={props.tone}>{props.text}</span>;
}
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
        <For each={rows()}>{(row) => <Row row={row} selected={selected() === row.id} badge={{ "data-kind": "b", size: "sm" }} />}</For>
      </tbody>
    </table>
  );
}
const wrap = (d) => {
  const [label, setLabel] = createSignal(d.label),
    [count, setCount] = createSignal(d.count);
  return { id: d.id, label, setLabel, count, setCount };
};
export const app = {
  table: () => <Table />,
  load: (data) => setRows(data.map(wrap)),
  clear: () => {
    setRows([]);
    setSelected(-1);
  },
  relabel: (suffix) => batch(() => rows().forEach((r) => r.setLabel(r.label() + suffix))),
  select: (id) => setSelected(id),
  bump: (stride) => batch(() => rows().forEach((r, i) => i % stride === 0 && r.setCount(r.count() + 1))),
};
