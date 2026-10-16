import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { watchInteractOutside } from "@rivetjs/cdk/interactions/interact-outside";

export const head = { title: "Outside" };

export default function OutsideStory() {
  const box = ref<HTMLDivElement>();
  const count = signal(0);
  watchInteractOutside({ ref: box, onInteractOutside: () => count.update((n) => n + 1) });
  return (
    <section>
      <div id="box" ref={box}>
        Inside{" "}
        <button type="button" id="inside">
          inside
        </button>
      </div>
      <button type="button" id="outside">
        Outside
      </button>
      <p id="outside-count">{count()}</p>
    </section>
  );
}
