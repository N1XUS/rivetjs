import { ToggleButton } from "@rivetjs/cdk/toggle-button";

export const head = { title: "Disabled ToggleButton" };

// #region demo
export default function DisabledToggles() {
  return (
    <div class="m-4 flex flex-wrap gap-2 text-sm">
      <ToggleButton id="grid">Grid</ToggleButton>
      <ToggleButton id="locked" defaultSelected isDisabled>
        Locked on
      </ToggleButton>
      <ToggleButton id="mouse-only" excludeFromTabOrder>
        Not in Tab order
      </ToggleButton>
      <ToggleButton id="after">Rulers</ToggleButton>
    </div>
  );
}
// #endregion
