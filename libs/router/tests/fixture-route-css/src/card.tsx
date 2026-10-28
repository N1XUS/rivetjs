import "./card.css";
import type { Content } from "@rivetjs/runtime/jsx-runtime";

export function Card(props: { children?: Content }) {
  return <section class="card">{props.children}</section>;
}
