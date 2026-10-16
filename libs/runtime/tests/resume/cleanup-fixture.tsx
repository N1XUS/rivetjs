// Resumed page: a conditional child created in the browser runs its onCleanup when its condition turns
// false (cdk DatePicker popover close). resume-cleanup-browser.test.ts.
import { signal, onCleanup } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";
import { Show, Portal } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";

function Child(props: { log: Signal<string> }) {
  onCleanup(() => props.log.update((l) => l + "c"));
  return <p id="child">child</p>;
}

// A wrapper taking the child as lazy JSX children (cdk Popover / Dialog content).
function Frame(props: { children?: Content }) {
  return <section class="frame">{props.children}</section>;
}

export function Page() {
  const open = signal(false);
  const log = signal("");
  return (
    <main>
      <button id="toggle" onClick={() => open.update((v) => !v)}>
        toggle
      </button>
      <output id="log">{log()}</output>
      <div id="slot">
        <Show when={() => open()}>{() => <Child log={log} />}</Show>
      </div>
      <div id="ternary">{open() ? <Child log={log} /> : null}</div>
      <div id="framed">
        <Show when={() => open()}>
          {() => (
            <Frame>
              <Child log={log} />
            </Frame>
          )}
        </Show>
      </div>
      <div id="portaled">
        <Show when={() => open()}>
          {() => (
            <Portal>
              <Child log={log} />
            </Portal>
          )}
        </Show>
      </div>
    </main>
  );
}
