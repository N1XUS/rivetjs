// `<Motion.<tag>>`: one component per tag (`index.tsx` exports this module as the `Motion` namespace, so a bundle
// carries only the tags it uses). Each body is the same compiled element over `motionElement` (element.tsx): a literal
// tag, so the compiler records its spread, attribute bindings and handlers as resume sites (`Dynamic` props are not).
// `m.bind` (one spread) carries the ref and the handlers of the gesture groups present at creation: no attribute
// slot per absent handler (the server renderer pays per slot; its spread skips `ref` / `on*` by name).
// `entrance` (client-render entrance rules, css.ts) comes from here, not element.tsx: a resumed page's gesture handlers
// load element.tsx's graph only. Add a tag here (same body) when a page needs it; void elements take no children.
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import { motionElement, type MotionTagProps } from "./element.tsx";
import { entrance } from "./entrance.ts";

export const a = (props: MotionTagProps<"a">): JSX.Element => {
  const m = motionElement(props as never, "a", entrance);
  return m.mount(
    <a {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </a>,
  ) as JSX.Element;
};
export const article = (props: MotionTagProps<"article">): JSX.Element => {
  const m = motionElement(props as never, "article", entrance);
  return m.mount(
    <article {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </article>,
  ) as JSX.Element;
};
export const aside = (props: MotionTagProps<"aside">): JSX.Element => {
  const m = motionElement(props as never, "aside", entrance);
  return m.mount(
    <aside {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </aside>,
  ) as JSX.Element;
};
export const b = (props: MotionTagProps<"b">): JSX.Element => {
  const m = motionElement(props as never, "b", entrance);
  return m.mount(
    <b {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </b>,
  ) as JSX.Element;
};
export const blockquote = (props: MotionTagProps<"blockquote">): JSX.Element => {
  const m = motionElement(props as never, "blockquote", entrance);
  return m.mount(
    <blockquote {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </blockquote>,
  ) as JSX.Element;
};
export const button = (props: MotionTagProps<"button">): JSX.Element => {
  const m = motionElement(props as never, "button", entrance);
  return m.mount(
    <button {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </button>,
  ) as JSX.Element;
};
export const code = (props: MotionTagProps<"code">): JSX.Element => {
  const m = motionElement(props as never, "code", entrance);
  return m.mount(
    <code {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </code>,
  ) as JSX.Element;
};
export const dd = (props: MotionTagProps<"dd">): JSX.Element => {
  const m = motionElement(props as never, "dd", entrance);
  return m.mount(
    <dd {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </dd>,
  ) as JSX.Element;
};
export const details = (props: MotionTagProps<"details">): JSX.Element => {
  const m = motionElement(props as never, "details", entrance);
  return m.mount(
    <details {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </details>,
  ) as JSX.Element;
};
export const div = (props: MotionTagProps<"div">): JSX.Element => {
  const m = motionElement(props as never, "div", entrance);
  return m.mount(
    <div {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </div>,
  ) as JSX.Element;
};
export const dl = (props: MotionTagProps<"dl">): JSX.Element => {
  const m = motionElement(props as never, "dl", entrance);
  return m.mount(
    <dl {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </dl>,
  ) as JSX.Element;
};
export const dt = (props: MotionTagProps<"dt">): JSX.Element => {
  const m = motionElement(props as never, "dt", entrance);
  return m.mount(
    <dt {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </dt>,
  ) as JSX.Element;
};
export const em = (props: MotionTagProps<"em">): JSX.Element => {
  const m = motionElement(props as never, "em", entrance);
  return m.mount(
    <em {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </em>,
  ) as JSX.Element;
};
export const figcaption = (props: MotionTagProps<"figcaption">): JSX.Element => {
  const m = motionElement(props as never, "figcaption", entrance);
  return m.mount(
    <figcaption {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </figcaption>,
  ) as JSX.Element;
};
export const figure = (props: MotionTagProps<"figure">): JSX.Element => {
  const m = motionElement(props as never, "figure", entrance);
  return m.mount(
    <figure {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </figure>,
  ) as JSX.Element;
};
export const footer = (props: MotionTagProps<"footer">): JSX.Element => {
  const m = motionElement(props as never, "footer", entrance);
  return m.mount(
    <footer {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </footer>,
  ) as JSX.Element;
};
export const form = (props: MotionTagProps<"form">): JSX.Element => {
  const m = motionElement(props as never, "form", entrance);
  return m.mount(
    <form {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </form>,
  ) as JSX.Element;
};
export const h1 = (props: MotionTagProps<"h1">): JSX.Element => {
  const m = motionElement(props as never, "h1", entrance);
  return m.mount(
    <h1 {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </h1>,
  ) as JSX.Element;
};
export const h2 = (props: MotionTagProps<"h2">): JSX.Element => {
  const m = motionElement(props as never, "h2", entrance);
  return m.mount(
    <h2 {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </h2>,
  ) as JSX.Element;
};
export const h3 = (props: MotionTagProps<"h3">): JSX.Element => {
  const m = motionElement(props as never, "h3", entrance);
  return m.mount(
    <h3 {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </h3>,
  ) as JSX.Element;
};
export const h4 = (props: MotionTagProps<"h4">): JSX.Element => {
  const m = motionElement(props as never, "h4", entrance);
  return m.mount(
    <h4 {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </h4>,
  ) as JSX.Element;
};
export const h5 = (props: MotionTagProps<"h5">): JSX.Element => {
  const m = motionElement(props as never, "h5", entrance);
  return m.mount(
    <h5 {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </h5>,
  ) as JSX.Element;
};
export const h6 = (props: MotionTagProps<"h6">): JSX.Element => {
  const m = motionElement(props as never, "h6", entrance);
  return m.mount(
    <h6 {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </h6>,
  ) as JSX.Element;
};
export const header = (props: MotionTagProps<"header">): JSX.Element => {
  const m = motionElement(props as never, "header", entrance);
  return m.mount(
    <header {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </header>,
  ) as JSX.Element;
};
export const hr = (props: MotionTagProps<"hr">): JSX.Element => {
  const m = motionElement(props as never, "hr", entrance);
  return m.mount(
    <hr {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv} />,
  ) as JSX.Element;
};
export const i = (props: MotionTagProps<"i">): JSX.Element => {
  const m = motionElement(props as never, "i", entrance);
  return m.mount(
    <i {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </i>,
  ) as JSX.Element;
};
export const img = (props: MotionTagProps<"img">): JSX.Element => {
  const m = motionElement(props as never, "img", entrance);
  return m.mount(
    <img {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv} />,
  ) as JSX.Element;
};
export const input = (props: MotionTagProps<"input">): JSX.Element => {
  const m = motionElement(props as never, "input", entrance);
  return m.mount(
    <input {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv} />,
  ) as JSX.Element;
};
export const label = (props: MotionTagProps<"label">): JSX.Element => {
  const m = motionElement(props as never, "label", entrance);
  return m.mount(
    <label {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </label>,
  ) as JSX.Element;
};
export const li = (props: MotionTagProps<"li">): JSX.Element => {
  const m = motionElement(props as never, "li", entrance);
  return m.mount(
    <li {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </li>,
  ) as JSX.Element;
};
export const main = (props: MotionTagProps<"main">): JSX.Element => {
  const m = motionElement(props as never, "main", entrance);
  return m.mount(
    <main {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </main>,
  ) as JSX.Element;
};
export const nav = (props: MotionTagProps<"nav">): JSX.Element => {
  const m = motionElement(props as never, "nav", entrance);
  return m.mount(
    <nav {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </nav>,
  ) as JSX.Element;
};
export const ol = (props: MotionTagProps<"ol">): JSX.Element => {
  const m = motionElement(props as never, "ol", entrance);
  return m.mount(
    <ol {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </ol>,
  ) as JSX.Element;
};
export const p = (props: MotionTagProps<"p">): JSX.Element => {
  const m = motionElement(props as never, "p", entrance);
  return m.mount(
    <p {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </p>,
  ) as JSX.Element;
};
export const pre = (props: MotionTagProps<"pre">): JSX.Element => {
  const m = motionElement(props as never, "pre", entrance);
  return m.mount(
    <pre {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </pre>,
  ) as JSX.Element;
};
export const section = (props: MotionTagProps<"section">): JSX.Element => {
  const m = motionElement(props as never, "section", entrance);
  return m.mount(
    <section {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </section>,
  ) as JSX.Element;
};
export const select = (props: MotionTagProps<"select">): JSX.Element => {
  const m = motionElement(props as never, "select", entrance);
  return m.mount(
    <select {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </select>,
  ) as JSX.Element;
};
export const small = (props: MotionTagProps<"small">): JSX.Element => {
  const m = motionElement(props as never, "small", entrance);
  return m.mount(
    <small {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </small>,
  ) as JSX.Element;
};
export const span = (props: MotionTagProps<"span">): JSX.Element => {
  const m = motionElement(props as never, "span", entrance);
  return m.mount(
    <span {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </span>,
  ) as JSX.Element;
};
export const strong = (props: MotionTagProps<"strong">): JSX.Element => {
  const m = motionElement(props as never, "strong", entrance);
  return m.mount(
    <strong {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </strong>,
  ) as JSX.Element;
};
export const summary = (props: MotionTagProps<"summary">): JSX.Element => {
  const m = motionElement(props as never, "summary", entrance);
  return m.mount(
    <summary {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </summary>,
  ) as JSX.Element;
};
export const table = (props: MotionTagProps<"table">): JSX.Element => {
  const m = motionElement(props as never, "table", entrance);
  return m.mount(
    <table {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </table>,
  ) as JSX.Element;
};
export const tbody = (props: MotionTagProps<"tbody">): JSX.Element => {
  const m = motionElement(props as never, "tbody", entrance);
  return m.mount(
    <tbody {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </tbody>,
  ) as JSX.Element;
};
export const td = (props: MotionTagProps<"td">): JSX.Element => {
  const m = motionElement(props as never, "td", entrance);
  return m.mount(
    <td {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </td>,
  ) as JSX.Element;
};
export const textarea = (props: MotionTagProps<"textarea">): JSX.Element => {
  const m = motionElement(props as never, "textarea", entrance);
  return m.mount(
    <textarea {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </textarea>,
  ) as JSX.Element;
};
export const th = (props: MotionTagProps<"th">): JSX.Element => {
  const m = motionElement(props as never, "th", entrance);
  return m.mount(
    <th {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </th>,
  ) as JSX.Element;
};
export const thead = (props: MotionTagProps<"thead">): JSX.Element => {
  const m = motionElement(props as never, "thead", entrance);
  return m.mount(
    <thead {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </thead>,
  ) as JSX.Element;
};
export const tr = (props: MotionTagProps<"tr">): JSX.Element => {
  const m = motionElement(props as never, "tr", entrance);
  return m.mount(
    <tr {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </tr>,
  ) as JSX.Element;
};
export const ul = (props: MotionTagProps<"ul">): JSX.Element => {
  const m = motionElement(props as never, "ul", entrance);
  return m.mount(
    <ul {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </ul>,
  ) as JSX.Element;
};
export const video = (props: MotionTagProps<"video">): JSX.Element => {
  const m = motionElement(props as never, "video", entrance);
  return m.mount(
    <video {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </video>,
  ) as JSX.Element;
};

// SVG
export const svg = (props: MotionTagProps<"svg">): JSX.Element => {
  const m = motionElement(props as never, "svg", entrance);
  return m.mount(
    <svg {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </svg>,
  ) as JSX.Element;
};
export const g = (props: MotionTagProps<"g">): JSX.Element => {
  const m = motionElement(props as never, "g", entrance);
  return m.mount(
    <g {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </g>,
  ) as JSX.Element;
};
export const path = (props: MotionTagProps<"path">): JSX.Element => {
  const m = motionElement(props as never, "path", entrance);
  return m.mount(
    <path {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </path>,
  ) as JSX.Element;
};
export const circle = (props: MotionTagProps<"circle">): JSX.Element => {
  const m = motionElement(props as never, "circle", entrance);
  return m.mount(
    <circle {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </circle>,
  ) as JSX.Element;
};
export const rect = (props: MotionTagProps<"rect">): JSX.Element => {
  const m = motionElement(props as never, "rect", entrance);
  return m.mount(
    <rect {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </rect>,
  ) as JSX.Element;
};
export const line = (props: MotionTagProps<"line">): JSX.Element => {
  const m = motionElement(props as never, "line", entrance);
  return m.mount(
    <line {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </line>,
  ) as JSX.Element;
};
export const polyline = (props: MotionTagProps<"polyline">): JSX.Element => {
  const m = motionElement(props as never, "polyline", entrance);
  return m.mount(
    <polyline {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </polyline>,
  ) as JSX.Element;
};
export const polygon = (props: MotionTagProps<"polygon">): JSX.Element => {
  const m = motionElement(props as never, "polygon", entrance);
  return m.mount(
    <polygon {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </polygon>,
  ) as JSX.Element;
};
export const ellipse = (props: MotionTagProps<"ellipse">): JSX.Element => {
  const m = motionElement(props as never, "ellipse", entrance);
  return m.mount(
    <ellipse {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </ellipse>,
  ) as JSX.Element;
};
export const text = (props: MotionTagProps<"text">): JSX.Element => {
  const m = motionElement(props as never, "text", entrance);
  return m.mount(
    <text {...(m.rest as object)} {...(m.bind as object)} data-mv-t={m.live()} style={m.style()} data-mve={m.mve} data-mvv={m.mvv}>
      {m.content()}
    </text>,
  ) as JSX.Element;
};
