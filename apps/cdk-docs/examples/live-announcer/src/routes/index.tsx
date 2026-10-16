import { announce, clearAnnouncer } from "@rivetjs/cdk/live-announcer";
import { LiveAnnouncerRegions } from "@rivetjs/cdk/announcer";

export const head = { title: "React Aria live announcer" };

const btn = "rounded border border-slate-300 px-2 py-1";

// #region demo
export default function Uploads() {
  return (
    <section class="m-4 grid max-w-md gap-3 text-sm">
      <div class="flex flex-wrap gap-2">
        <button id="polite" type="button" class={btn} onClick={() => announce("3 results", "polite")}>
          Polite
        </button>
        <button id="assertive" type="button" class={btn} onClick={() => announce("Upload failed")}>
          Assertive (default)
        </button>
        {/* The message is the text of another element (read through role="img" + aria-labelledby). */}
        <button id="labelled" type="button" class={btn} onClick={() => announce({ "aria-labelledby": "status-text" }, "polite", 10000)}>
          Announce the status line
        </button>
        <button id="clear" type="button" class={btn} onClick={() => clearAnnouncer()}>
          Clear
        </button>
      </div>
      <p id="status-text">2 of 5 files uploaded</p>
      {/* Server-rendered regions: adopted by announce(), so the first message is not lost. */}
      <LiveAnnouncerRegions />
    </section>
  );
}
// #endregion
