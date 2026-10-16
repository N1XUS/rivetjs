// SVG child elements returned by components and rendered inside a parent's `<svg>`: each component
// root is its own template, built without knowing its parent (G4, lucide icons).
import { signal } from "@rivetjs/reactivity";

type IconNode = [string, Record<string, string>][];

function Shapes() {
  return <path d="M1 1" />;
}
function Multi() {
  return (
    <>
      <circle r="2" />
      <rect width="1" />
    </>
  );
}
// Tags whose names HTML also knows (or rewrites: `image` → `img`).
function Ambiguous() {
  return (
    <>
      <a href="#x">
        <text>t</text>
      </a>
      <image href="/i.png" />
      <use href="#s" />
    </>
  );
}
// A tree DOM v2 lowers through v1 (`title`), rooted at `image`.
function Captioned() {
  return (
    <image href="/k.png">
      <title>k</title>
    </image>
  );
}
function Frame(props: { children?: unknown }) {
  return <svg class="frame">{props.children}</svg>;
}
// lucide-style: shapes from data through a component.
function Shape(props: { node: [string, Record<string, string>] }) {
  return props.node[0] === "path" ? <path {...props.node[1]} /> : <circle {...props.node[1]} />;
}
// Spread onto an `<svg>` root (inline `?svg` components): `class` is an attribute there, not `className`.
function Spread(props: { class?: string; viewBox?: string }) {
  return (
    <svg {...props}>
      <path d="M5 5" />
    </svg>
  );
}
// A conditional `<title>` (a v1 tree in the v2 lowering) built by an insertion read under the `<svg>`.
function Titled(props: { title?: string }) {
  return (
    <svg class="titled">
      {props.title ? <title>{props.title}</title> : null}
      <path d="M6 6" />
    </svg>
  );
}
const icon: IconNode = [
  ["path", { d: "M3 3" }],
  ["circle", { r: "4" }],
];

export function Page() {
  const n = signal(0);
  return (
    <main>
      <svg class="direct">
        <Shapes />
        <Multi />
        <Ambiguous />
        <Captioned />
      </svg>
      <Frame>
        <Shapes />
        <path d="M2 2" />
      </Frame>
      <svg class="data">
        {icon.map((node) => (
          <Shape node={node} />
        ))}
      </svg>
      <Spread class="spread" viewBox="0 0 2 2" />
      <Titled title="T" />
      <button id="inc" onClick={() => n.update((v) => v + 1)}>
        {n()}
      </button>
      {n() > 0 ? (
        <svg class="late">
          <Shapes />
          <Ambiguous />
        </svg>
      ) : null}
    </main>
  );
}
