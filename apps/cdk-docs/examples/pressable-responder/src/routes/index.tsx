import { signal } from "@rivetjs/reactivity";
import { PressResponder, Pressable } from "@rivetjs/cdk/interactions/pressable";
import { Focusable, FocusableProvider } from "@rivetjs/cdk/focusable";

export const head = { title: "Pressable and PressResponder" };

// #region demo
export default function PressableDemo() {
  const log = signal<string[]>([]);
  const count = signal(0);
  return (
    <div class="demo">
      {/* The child is a render function: spread the props and pass the ref. */}
      <PressResponder onPress={() => log.set([...log(), "responder press"])}>
        <Pressable
          onPress={() => {
            count.set(count() + 1);
            log.set([...log(), "own press"]);
          }}
        >
          {(p) => (
            <div {...p} ref={p.ref as never} id="pr-card" role="button" class="card">
              Press this card
            </div>
          )}
        </Pressable>
      </PressResponder>
      <output id="pr-log">{log().join(", ")}</output>
      <output id="pr-count">{count()}</output>
      <span id="pr-help" hidden>
        Opens the help panel
      </span>
      <FocusableProvider aria-describedby="pr-help">
        <Focusable>
          {(p) => (
            <span {...p} ref={p.ref as never} id="pr-focus" role="button" class="card">
              Help
            </span>
          )}
        </Focusable>
      </FocusableProvider>
    </div>
  );
}
// #endregion
