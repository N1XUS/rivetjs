import { signal } from "@rivetjs/reactivity";
import { ToggleButtonGroup } from "@rivetjs/cdk/toggle-button-group";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";

export const head = { title: "ToggleButtonGroup (single selection)" };

// #region demo
export default function ViewMode() {
  const view = signal("list");
  return (
    <div class="demo">
      <ToggleButtonGroup id="view" aria-label="View" defaultSelectedKeys={["list"]} onSelectionChange={(keys) => view.set([...keys].join(", ") || "none")}>
        <ToggleButton id="list">List</ToggleButton>
        <ToggleButton id="grid">Grid</ToggleButton>
        <ToggleButton id="gallery">Gallery</ToggleButton>
      </ToggleButtonGroup>
      <output id="view-value">Selected: {view()}</output>
    </div>
  );
}
// #endregion
