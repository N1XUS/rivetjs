import { signal } from "@rivetjs/reactivity";
import { Motion } from "@rivetjs/motion";
// Entrances in content streamed after the head use inline custom properties; this sheet plays them.
import "@rivetjs/motion/entrance.css";
import { Presence, PresenceFor } from "@rivetjs/motion/presence";
import { Check, Plus } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Motion presence" };

type Task = { id: number; text: string };

// #region demo
export default function PresenceDemo() {
  const open = signal(true);
  const tasks = signal<Task[]>([
    { id: 1, text: "Write docs" },
    { id: 2, text: "Ship the release" },
    { id: 3, text: "Celebrate" },
  ]);
  const next = signal(4);
  return (
    <div class="m-4 grid gap-4">
      <button id="toggle" type="button" class="justify-self-start rounded-md border border-slate-300 px-3 py-1.5" onClick={() => open.update((o) => !o)}>
        {open() ? "Hide notice" : "Show notice"}
      </button>
      {/* Presence keeps the content until its exit animation finished. */}
      <Presence show={open}>
        {() => (
          <Motion.p
            id="notice"
            class="rounded-md bg-amber-100 px-4 py-3 text-amber-900"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            Saved drafts are kept for 30 days.
          </Motion.p>
        )}
      </Presence>
      <ul id="tasks" class="grid gap-2">
        {/* PresenceFor: a removed row stays at its index (data-exiting) while it leaves. */}
        <PresenceFor each={tasks} by={(task) => task.id}>
          {(task) => (
            <Motion.li
              id={"task-" + task().id}
              class="flex items-center justify-between rounded-md border border-slate-300 bg-white px-3 py-2"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.25 }}
            >
              {task().text}
              <button
                id={"done-" + task().id}
                type="button"
                aria-label={"Done: " + task().text}
                class="rounded p-1 text-teal-700 hover:bg-teal-50"
                onClick={() => tasks.update((list) => list.filter((t) => t.id !== task().id))}
              >
                <Icon icon={Check} />
              </button>
            </Motion.li>
          )}
        </PresenceFor>
      </ul>
      <button
        id="add"
        type="button"
        class="flex items-center gap-1 justify-self-start rounded-md bg-teal-700 px-3 py-1.5 font-semibold text-white"
        onClick={() => {
          const id = next();
          next.set(id + 1);
          tasks.update((list) => [...list, { id, text: "Task " + id }]);
        }}
      >
        <Icon icon={Plus} />
        Add task
      </button>
    </div>
  );
}
// #endregion
