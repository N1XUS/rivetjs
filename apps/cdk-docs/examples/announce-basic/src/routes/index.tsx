import { signal } from "@rivetjs/reactivity";
import { announce, visuallyHidden } from "@rivetjs/cdk/a11y";
import { Announcer } from "@rivetjs/cdk/announcer";

export const head = { title: "Announcements" };

// #region demo
export default function Draft() {
  const saves = signal(0);
  const heard = signal("nothing yet");
  const onSave = () => {
    saves.update((n) => n + 1);
    const message = `Draft saved (${saves()})`;
    announce(message); // polite: read after the current speech
    heard.set(message);
  };
  const onFail = () => {
    announce("Could not reach the server", "assertive"); // interrupts
    heard.set("Could not reach the server");
  };
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <div class="flex gap-2">
        <button id="save" type="button" class="rounded-md bg-teal-700 px-3 py-1 font-semibold text-white" onClick={onSave}>
          Save draft
        </button>
        <button id="fail" type="button" class="rounded-md border border-slate-300 px-3 py-1" onClick={onFail}>
          Simulate an error
          <span style={visuallyHidden}> (announces an alert)</span>
        </button>
      </div>
      <p id="heard" class="text-slate-600">
        Screen readers hear: {heard()}
      </p>
      {/* Once per page, usually in the root layout: the live regions exist before any message. */}
      <Announcer />
    </section>
  );
}
// #endregion
