// A ref() first decoded by the re-creation of the region holding its element (lane ARM-FIX,
// resume-ref-recreate-browser.test.ts). The re-creation disposes the region's resumed owner before it decodes the
// region's state (`_regionState` locals, provider values); the ref's element sits inside that region, so the ref must
// not register its reset on the disposed owner ("Cannot run with a disposed owner", cdk Button in TooltipTrigger
// 2026-10-19). It resets at once instead, and the re-created element takes it.
import { signal, createContext, useContext, _regionState, type Signal } from "@rivetjs/reactivity";
import { ref, type Ref } from "@rivetjs/runtime/dom";
import { Provider } from "@rivetjs/runtime/server";
import { resumableContext } from "@rivetjs/runtime/resume-format";

const report = (key: string, value: string): void => void ((globalThis as unknown as Record<string, string>)["__" + key] = value);

/** `_regionState` locals: the count read at render re-creates the component. The press handler decodes another ref
 * inside the region first (`mark`: armed, so the region has a resumed owner), then the first change re-creates the
 * region, which disposes that owner and decodes the locals: `button` points into the dying region. */
function Locals() {
  const count = _regionState(() => signal(0));
  const button = _regionState(() => ref<HTMLButtonElement>());
  const mark = ref<HTMLElement>();
  const label = count() > 0 ? "more" : "zero";
  return (
    <section>
      <button
        id="local"
        type="button"
        ref={button}
        onClick={() => {
          mark()!.dataset.hit = "";
          count.set(count() + 1);
        }}
      >
        <span ref={mark}>{label}</span>
      </button>
      <button id="local-probe" type="button" onClick={() => report("local", button() === document.getElementById("local") ? "new" : "stale")}>
        probe
      </button>
    </section>
  );
}

/** A provided value holding the ref (cdk FocusableContext's shape): the region re-creation decodes it from its
 * provider list. */
const Focus = resumableContext(createContext<{ ref: Ref<HTMLButtonElement> } | null>(null, { id: "arm-focus" }));
function Child(props: { count: Signal<number> }) {
  const focus = useContext(Focus)!;
  const mark = ref<HTMLElement>();
  const label = props.count() > 0 ? "more" : "zero";
  return (
    <button
      id="provided"
      type="button"
      ref={focus.ref}
      onClick={() => {
        mark()!.dataset.hit = "";
        props.count.set(props.count() + 1);
      }}
    >
      <span ref={mark}>{label}</span>
    </button>
  );
}
function Provided() {
  const count = signal(0);
  const button = ref<HTMLButtonElement>();
  return (
    <section>
      <Provider token={Focus} value={{ ref: button }}>
        <div>
          <Child count={count} />
        </div>
      </Provider>
      <button id="provided-probe" type="button" onClick={() => report("provided", button() === document.getElementById("provided") ? "new" : "stale")}>
        probe
      </button>
    </section>
  );
}

export function Page() {
  return (
    <main>
      <Locals />
      <Provided />
    </main>
  );
}
