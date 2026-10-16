import { signal } from "@rivetjs/reactivity";
import { Show, Dynamic } from "@rivetjs/runtime/dom";

type IconNode = [string, Record<string, string>][];

// SVG children built from a mapped expression (lucide icons): created before their parent exists
// in the v2 lowering, under a fallback HTML context.
export function Icon(props: { icon: IconNode }) {
  return (
    <svg viewBox="0 0 24 24" class="icon">
      {props.icon.map(([tag, attrs]) => (tag === "path" ? <path {...attrs} /> : <circle {...attrs} />))}
    </svg>
  );
}
// Dynamic tag with spread attributes under an svg.
export function DynamicIcon(props: { icon: IconNode }) {
  return (
    <svg viewBox="0 0 24 24" class="dyn">
      {props.icon.map(([tag, attrs]) => (
        <Dynamic component={tag} {...attrs} />
      ))}
    </svg>
  );
}
// MathML child built the same way.
export function Math() {
  const rows = [1, 2];
  return (
    <math>
      {rows.map((n) => (
        <mi>{n}</mi>
      ))}
    </math>
  );
}

// Eager JSX (created once) passed into a component shown twice: the slot does not own it, so it
// must survive the branch unmount intact.
function Card(props: { children: unknown }) {
  return (
    <section class="card">
      <h2>Card</h2>
      {props.children as never}
    </section>
  );
}
export const open = signal(false);
export function Reopen() {
  const desc = (
    <p id="desc">
      description <b>bold</b>
    </p>
  );
  return (
    <div>
      <Show when={open}>{() => <Card>{desc}</Card>}</Show>
    </div>
  );
}
