// A region the `change` at the start of a blur re-creates (resume-blur-region-browser.test.ts): the browser fires
// `change`, then `blur` / `focusout` on the field — the form's delegated `focusout` handler must still see it (the ui
// TextField + `@rivetjs/forms` case, where the cdk `change` handler's write re-creates the field). A second region the
// `focus` of its input re-creates: the replacement takes focus inside the user's focus sequence (`focusin`). One
// component: every handler shares one chunk, so once the probe's click took effect the fields' events run live (not
// replayed cold).
import { signal } from "@rivetjs/reactivity";

export function Page() {
  const blurs = signal(0);
  const committed = signal("");
  const probed = signal(0);
  const focused = signal(0);
  // The field's focusouts, only while it is still in the document (a forms handler finds the form through the target).
  return (
    <form onFocusOut={(event) => (event.target as HTMLElement).id === "field" && (event.target as Element).isConnected && blurs.update((n) => n + 1)}>
      <div>
        {/* The function child's own read makes it a region holding the input: the `change` handler's write re-creates it. */}
        {() => {
          const value = committed();
          return (
            <>
              <output id="committed">{value || "none"}</output>
              <input id="field" onChange={(event) => committed.set((event.target as HTMLInputElement).value)} />
            </>
          );
        }}
      </div>
      <div>
        {/* Re-created by its input's first focus (a cdk `useFocus` state write in the field's own region). */}
        {() => {
          const count = focused();
          return (
            <>
              <output id="focused">{count}</output>
              <input id="focus-field" onFocus={() => focused.set(1)} />
            </>
          );
        }}
      </div>
      <button type="button" id="probe" onClick={() => probed.update((n) => n + 1)}>
        probe
      </button>
      <output id="probed">{probed()}</output>
      <output id="blurs">{blurs()}</output>
    </form>
  );
}
