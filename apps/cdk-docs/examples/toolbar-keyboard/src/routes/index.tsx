import { Toolbar } from "@rivetjs/cdk/toolbar";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";

export const head = { title: "Toolbar keyboard navigation" };

// #region demo
export default function Formatting() {
  return (
    <section class="m-4 grid justify-items-start gap-3 text-sm">
      <button type="button" id="tb-before">
        Before
      </button>
      <Toolbar id="format" aria-label="Text formatting" class="flex items-center gap-1">
        <ToggleButton id="tb-bold">Bold</ToggleButton>
        <ToggleButton id="tb-italic">Italic</ToggleButton>
        <hr aria-orientation="vertical" class="h-6 border-l border-slate-300" />
        {/* A nested toolbar renders role="group": the outer toolbar handles the keys. */}
        <Toolbar id="align-group" aria-label="Alignment" class="flex gap-1">
          <button type="button" id="tb-left">
            Left
          </button>
          <button type="button" id="tb-center">
            Center
          </button>
          <button type="button" id="tb-right">
            Right
          </button>
        </Toolbar>
      </Toolbar>
      <button type="button" id="tb-after">
        After
      </button>
    </section>
  );
}
// #endregion
