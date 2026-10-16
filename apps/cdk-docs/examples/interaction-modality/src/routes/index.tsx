import { createFocusVisible, createInteractionModality, setInteractionModality } from "@rivetjs/cdk/interactions/focus-visible";

export const head = { title: "Interaction modality" };

// #region demo
export default function Modality() {
  // Both install the global listeners in a client effect (at load on a resumed page).
  const modality = createInteractionModality();
  const { isFocusVisible } = createFocusVisible();
  return (
    <section class="m-4 grid max-w-sm gap-3 text-sm">
      <div class="flex gap-2">
        <button id="target" type="button" class="rounded border border-slate-300 px-2 py-1">
          Click or Tab
        </button>
        <button id="after" type="button" class="rounded border border-slate-300 px-2 py-1">
          Next
        </button>
        <button id="virtual" type="button" class="rounded border border-slate-300 px-2 py-1" onClick={() => setInteractionModality("virtual")}>
          Pretend screen reader
        </button>
      </div>
      <p>
        Modality: <output id="modality">{modality() ?? "unknown"}</output>
      </p>
      <p>
        Focus visible: <output id="visible">{String(isFocusVisible())}</output>
      </p>
    </section>
  );
}
// #endregion
