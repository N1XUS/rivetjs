import { signal, untrack } from "@rivetjs/reactivity";
import { clientEffect, clientEvent, For, ref } from "@rivetjs/runtime/dom";

export function Sentinel(props: { hit: () => void; when: "visible" | "idle" | "load" }) {
  const element = ref<HTMLDivElement>();
  clientEffect(
    () => {
      const el = element()!;
      el.dataset.installed = "yes";
      untrack(props.hit);
    },
    { when: props.when === "load" ? "interaction" : props.when },
  );
  // clientEvent has an actual LOAD policy (clientEffect's load policy intentionally maps to IDLE).
  clientEvent(globalThis as unknown as Window, "ping", props.hit, { when: props.when });
  return (
    <div id="sentinel" ref={element} style={{ height: "1px" }}>
      Sentinel
    </div>
  );
}

export function App(props: { when: "visible" | "idle" | "load" }) {
  const count = signal(0);
  const hit = () => count.set(count() + 1);
  const items = Array.from({ length: 1001 }, (_, i) => i);
  return (
    <main>
      <button id="boot" onClick={() => {}}>
        Boot parent
      </button>
      <output id="count">{count()}</output>
      <div id="scroll" style={{ height: "120px", overflow: "auto" }}>
        <For each={items} by={(item) => item}>
          {(item) =>
            item() === 500 ? (
              <Sentinel hit={hit} when={props.when} />
            ) : (
              <button class="ordinary" style={{ display: "block", height: "20px" }} onClick={() => {}}>
                {item()}
              </button>
            )
          }
        </For>
      </div>
    </main>
  );
}
