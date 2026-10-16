import { ToggleButton } from "@rivetjs/cdk/toggle-button";

export const head = { title: "ToggleButton with plain CSS" };

// #region demo
export default function CssToggles() {
  return (
    <div class="demo">
      <ToggleButton id="css-wrap">Wrap lines</ToggleButton>
      <ToggleButton defaultSelected>Line numbers</ToggleButton>
      <ToggleButton isDisabled>Minimap</ToggleButton>
    </div>
  );
}
// #endregion
