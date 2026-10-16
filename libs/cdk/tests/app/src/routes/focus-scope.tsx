import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { FocusScope, useFocusManager } from "@rivetjs/cdk/focus-scope";

export const head = { title: "FocusScope" };

export default function FocusScopeStory() {
  const open = signal(false);
  const manager = useFocusManager();
  return (
    <section>
      <button id="before" type="button">
        Before
      </button>
      <FocusScope contain>
        <input id="s1" aria-label="One" />
        <button id="s2" type="button" onKeyDown={(e) => e.key === "ArrowRight" && manager.focusNext({ wrap: true })}>
          Two
        </button>
        <button id="s3" type="button">
          Three
        </button>
      </FocusScope>
      <button id="open" type="button" onClick={() => open.set(true)}>
        Open
      </button>
      <Show when={open}>
        <FocusScope contain restoreFocus autoFocus>
          <button id="d1" type="button">
            D1
          </button>
          <button id="close" type="button" onClick={() => open.set(false)}>
            Close
          </button>
        </FocusScope>
      </Show>
      <button id="after" type="button">
        After
      </button>
    </section>
  );
}
