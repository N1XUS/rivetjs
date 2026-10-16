import { signal } from "@rivetjs/reactivity";
import { Transition, TransitionChild } from "@rivetjs/kit/transition";

export const head = { title: "Transition" };

export default function TransitionStory() {
  const open = signal(false);
  const nested = signal(true);
  return (
    <section>
      <button id="toggle" type="button" onClick={() => open.update((v) => !v)}>
        Toggle
      </button>
      <Transition show={open} id="panel" enter="fade" enterFrom="from" enterTo="to" entered="done" leave="fade" leaveFrom="to" leaveTo="from">
        Panel
      </Transition>
      <button id="toggle-nested" type="button" onClick={() => nested.update((v) => !v)}>
        Nested
      </button>
      <Transition show={nested} id="outer" leave="fade" leaveFrom="to" leaveTo="from">
        {() => (
          <TransitionChild id="inner" leave="slow" leaveFrom="to" leaveTo="from">
            Inner
          </TransitionChild>
        )}
      </Transition>
    </section>
  );
}
