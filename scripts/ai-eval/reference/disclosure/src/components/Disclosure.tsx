import { signal } from "@rivetjs/reactivity";
import type { Content } from "@rivetjs/runtime/jsx-runtime";

/** A button that shows and hides its content. `id` prefixes the button (`<id>-button`) and panel (`<id>-panel`) ids. */
export function Disclosure(props: { id: string; title: string; children?: Content }) {
  const open = signal(false);
  return (
    <div class="disclosure">
      <button
        id={`${props.id}-button`}
        type="button"
        aria-expanded={open() ? "true" : "false"}
        aria-controls={`${props.id}-panel`}
        onClick={() => open.update((value) => !value)}
      >
        {props.title}
      </button>
      <div id={`${props.id}-panel`} hidden={!open()}>
        {props.children}
      </div>
    </div>
  );
}
