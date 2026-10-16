// SSR-OMITTED-SLOTS (review LOW-1): inert `omitted()` slots are null now. Elements whose resumable
// parts sit next to such slots — a `prop:` element effect, a `window:` client event, an absent
// conditional handler — still resume: their `_rFn` handler fires and their `ref()` holds the element.
import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";

export function Omitted(props: { armed?: boolean }) {
  const count = signal(0);
  const resized = signal(0);
  const button = ref<HTMLButtonElement>();
  const boost = props.armed ? () => count.set(count() + 10) : undefined;
  const never = props.armed ? undefined : () => count.set(-1);
  return (
    <main>
      <button
        id="b"
        ref={button}
        prop:title={"n" + count()}
        onClick={() => (button()!.dataset.clicks = String(count.set(count() + 1)))}
        onPointerDown={boost}
        onKeyDown={never}
        window:onResize={() => resized.set(resized() + 1)}
      >
        {count()}
      </button>
      <output id="resized">{resized()}</output>
    </main>
  );
}
