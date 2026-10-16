import { signal } from "@rivetjs/reactivity";
import { Badge } from "../components/Badge.tsx";

export const head = { title: "Component props" };

// #region demo
export default function Page() {
  const messages = signal(0);
  const alerts = signal(3);
  return (
    <div class="m-4 flex flex-wrap items-center gap-3 text-sm">
      <button
        id="inc"
        type="button"
        class="rounded-md bg-teal-700 px-3 py-1 font-semibold text-white"
        onClick={() => messages.update((n) => n + 1)}
      >
        New message
      </button>
      {/* Props are live: Badge's binding follows messages() / alerts(). */}
      <Badge label="Messages" count={messages()} />
      <Badge label="Alerts" count={alerts()} />
    </div>
  );
}
// #endregion
