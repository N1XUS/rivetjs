// Rivet addition (no HeroUI counterpart): PresenceFor + layout from @rivetjs/motion on ui surfaces.
import { signal } from "@rivetjs/reactivity";
import { ref } from "@rivetjs/runtime/dom";
import { Icon } from "@rivetjs/kit/icon";
import { Bell, X } from "lucide";
import { Motion } from "@rivetjs/motion";
import { PresenceFor } from "@rivetjs/motion/presence";
import { animateLayout } from "@rivetjs/motion/layout";
import { Button } from "@rivetjs/ui/button";

export const head = { title: "Motion: Notification stack" };

type Note = { id: number; text: string };

// #region demo
export function NotificationStack() {
  const notes = signal<Note[]>([
    { id: 1, text: "Build finished in 12 s" },
    { id: 2, text: "Ada commented on your pull request" },
  ]);
  const next = signal(3);
  const stack = ref<HTMLElement>();
  return (
    <div class="flex w-80 flex-col gap-4">
      <Button
        id="add"
        variant="secondary"
        onPress={() => {
          const id = next();
          next.set(id + 1);
          // The cards below slide down to make room for the new one.
          animateLayout(stack, () => notes.update((list) => [{ id, text: "New message #" + id }, ...list]));
        }}
      >
        <Icon icon={Bell} class="size-4" />
        Notify
      </Button>
      {/* `relative` (block flow: an absolute row keeps its place) + the rows' `data-exiting:absolute`: a dismissed card
          leaves the flow while it slides out (motion/react's popLayout), so the cards below move up into its place at once. */}
      <ul ref={stack} class="relative space-y-2">
        <PresenceFor each={notes} by={(note) => note.id}>
          {(note) => (
            <Motion.li
              id={"note-" + note().id}
              layout="position"
              class="flex items-center justify-between gap-3 data-exiting:absolute data-exiting:inset-x-0 rounded-xl bg-surface px-4 py-3 text-sm shadow-sm"
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 48 }}
              transition={{ duration: 0.25 }}
            >
              {note().text}
              <button
                id={"dismiss-" + note().id}
                type="button"
                aria-label="Dismiss"
                class="rounded-full p-1 text-muted hover:bg-default"
                // The cards below slide up into the gap.
                onClick={() => animateLayout(stack, () => notes.update((list) => list.filter((n) => n.id !== note().id)))}
              >
                <Icon icon={X} class="size-4" />
              </button>
            </Motion.li>
          )}
        </PresenceFor>
      </ul>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-start justify-center p-6 [:where(&>*)]:max-w-full">
      <NotificationStack />
    </div>
  );
}
