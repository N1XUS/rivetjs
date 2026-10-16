// Spread props and attributes, compiled for both targets (spread.test.ts).
import type { Content } from "@rivetjs/runtime/jsx-runtime";

type Attrs = Record<string, unknown>;

/** Wrapper component: caller attributes pass through, `class` is extended (explicit after the spread wins). */
export function Button(props: { class?: string; children?: Content } & Attrs) {
  return (
    <button {...props} class={"btn " + (props.class ?? "")}>
      {props.children}
    </button>
  );
}
/** Source order: static before the spread is overridden by it; explicit after it wins. */
export function Order({ attrs }: { attrs: () => Attrs }) {
  return <div id="before" title="static" {...attrs()} data-last="explicit" />;
}
/** Trailing attributes (IMPL-SPREAD F1): own bindings that win over the spread's keys, also while unset. */
export function After({ attrs, t, c }: { attrs: () => Attrs; t: () => string | undefined; c: () => string | undefined }) {
  return <div {...attrs()} title={t()} data-k="k" className={c()} tabIndex={-1} />;
}
/** Reactive spread: keys added / removed, listener swapped. */
export function Live({ attrs, n }: { attrs: () => Attrs; n: () => number }) {
  return (
    <p class="live" {...attrs()} data-n={n()}>
      text
    </p>
  );
}
/** Media and SVG: URL rule per tag, SVG namespace. */
export function Media({ img, link, shape }: { img: Attrs; link: Attrs; shape: Attrs }) {
  return (
    <div>
      <img {...img} />
      <a {...link}>a</a>
      <svg>
        <circle {...shape} />
      </svg>
    </div>
  );
}
/** Explicit handlers stay separate listeners: both the spread one and the explicit one run. */
export function Handlers({ attrs, mine }: { attrs: Attrs; mine: () => void }) {
  return (
    <button {...attrs} onClick={mine}>
      h
    </button>
  );
}
/** Component props merged in source order (later keys win). */
function Show3(props: { a?: unknown; b?: unknown; c?: unknown }) {
  return (
    <i>
      {String(props.a)}/{String(props.b)}/{String(props.c)}
    </i>
  );
}
export function Props({ rest }: { rest: Attrs }) {
  return <Show3 a={1} {...rest} c={3} />;
}
export function UseButton({ label }: { label: () => string }) {
  return (
    <Button class="primary" type="submit" aria-label={label()}>
      Save
    </Button>
  );
}
/** Server list mounts: a row component whose root spreads (flattened twin plan). */
function Row({ r }: { r: { name: string; attrs: Attrs } }) {
  return (
    <li class="row" {...r.attrs}>
      {r.name}
    </li>
  );
}
export function List({ rows }: { rows: { name: string; attrs: Attrs }[] }) {
  return (
    <ul>
      {rows.map((r) => (
        <Row r={r} />
      ))}
    </ul>
  );
}
/** Spread `children`: the content when the element has no JSX children; explicit children win. */
export function Filled({ attrs }: { attrs: () => Attrs }) {
  return <section class="f" {...attrs()} />;
}
export function Explicit({ attrs }: { attrs: () => Attrs }) {
  return <section {...attrs()}>mine</section>;
}
/** Components: a spread `children` is the `children` prop unless JSX children are present. */
function Shell(props: { children?: Content }) {
  return <b>{props.children}</b>;
}
export function Pass({ rest }: { rest: { children?: Content } }) {
  return <Shell {...rest} />;
}
export function PassExplicit({ rest }: { rest: { children?: Content } }) {
  return <Shell {...rest}>mine</Shell>;
}
/** Server list mounts: spread content in a flattened row, two spread elements per row. */
function Cell({ r }: { r: { a: Attrs; b: Attrs } }) {
  return (
    <li>
      <i {...r.a} />
      <u {...r.b} />
    </li>
  );
}
export function Cells({ rows }: { rows: { a: Attrs; b: Attrs }[] }) {
  return (
    <ul>
      {rows.map((r) => (
        <Cell r={r} />
      ))}
    </ul>
  );
}
/** `style` in a spread: the same binder as an explicit `style={obj}` (object keys diffed, strings refused). */
type Style = Record<string, string | number> | (() => Record<string, string | number>) | undefined;
const unwrap = (value: Style) => (typeof value === "function" ? value() : value);
export function Styled({ obj }: { obj: () => Style }) {
  return <i id="explicit" style={unwrap(obj())} />;
}
export function StyledSpread({ obj }: { obj: () => Style }) {
  return <i id="spread" {...({ style: obj() } as Attrs)} />;
}
