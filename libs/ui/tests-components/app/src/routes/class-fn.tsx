// Function `class` (RAC render-prop class) on ui parts on a resumed page: the ui part composes it with its tv classes
// (`composeTwRenderProps`) and hands the result to the cdk element, whose class binding re-runs on a state change — the
// composed function must be a resumable symbol. `#cf-toggle` ToggleButton (`isSelected`), `#cf-button` Button (`isPressed` /
// `isHovered`), `#cf-progress` ProgressBar (`percentage`, stepped by native `#cf-next`).
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { ProgressBar } from "@rivetjs/ui/progress-bar";
import { ToggleButton } from "@rivetjs/ui/toggle-button";

export const head = { title: "Function class" };

export default function ClassFnStories() {
  const value = signal(25);
  const presses = signal(0);
  return (
    <main>
      <ToggleButton id="cf-toggle" class={({ isSelected }) => (isSelected() ? "cf-on" : "cf-off")}>
        Toggle
      </ToggleButton>
      <Button id="cf-button" class={({ isHovered }) => (isHovered() ? "cf-hover" : "cf-idle")} onPress={() => presses.set(presses() + 1)}>
        Press
      </Button>
      <output id="cf-presses">{presses()}</output>
      <button id="cf-next" type="button" onClick={() => value.set(value() >= 100 ? 25 : value() + 25)}>
        next
      </button>
      <ProgressBar id="cf-progress" aria-label="Loading" value={value()} class={({ percentage }) => `cf-p${percentage()}`}>
        <ProgressBar.Track>
          <ProgressBar.Fill />
        </ProgressBar.Track>
      </ProgressBar>
    </main>
  );
}
