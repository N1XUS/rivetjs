import { createStore, read, write } from "@rivetjs/reactivity/store";
import { For } from "@rivetjs/runtime/dom";

/** Immutable store writes update a keyed list; progress lasts until the page reloads. */
export function ReadingPlan(props: { topics: { id: string; title: string }[] }) {
  const plan = createStore({ topics: props.topics.map((topic) => ({ ...topic, done: false })) });
  return (
    <section class="mt-6" aria-labelledby="reading-plan">
      <h2 id="reading-plan" class="text-lg font-semibold">
        Your reading plan
      </h2>
      <p class="mt-2">{read(plan, "topics").filter((topic) => topic.done).length} topics completed. Progress resets on reload.</p>
      <ul class="mt-4 flex flex-col gap-2">
        <For each={read(plan, "topics")} by={(topic) => topic.id}>
          {(topic) => (
            <li>
              <label class="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={topic().done}
                  onChange={() => write(plan, "topics", (topics) => topics.map((item) => (item.id === topic().id ? { ...item, done: !item.done } : item)))}
                />
                {topic().title}
              </label>
            </li>
          )}
        </For>
      </ul>
    </section>
  );
}
