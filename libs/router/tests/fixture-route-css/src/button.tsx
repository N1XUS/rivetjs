import "./button.css";
import type { Content } from "@rivetjs/runtime/jsx-runtime";

export const label = (text: string): string => `[${text}]`;

export function Button(props: { id: string; onClick: () => void; children?: Content }) {
  return (
    <button type="button" class="button" id={props.id} onClick={props.onClick}>
      {props.children}
    </button>
  );
}
