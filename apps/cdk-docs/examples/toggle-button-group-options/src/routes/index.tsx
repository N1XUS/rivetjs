import { ToggleButtonGroup } from "@rivetjs/cdk/toggle-button-group";
import { ToggleButton } from "@rivetjs/cdk/toggle-button";

export const head = { title: "ToggleButtonGroup options" };

// #region demo
export default function Options() {
  return (
    <div class="demo">
      <ToggleButtonGroup id="align" aria-label="Alignment" defaultSelectedKeys={["left"]} disallowEmptySelection>
        <ToggleButton id="left">Left</ToggleButton>
        <ToggleButton id="center">Center</ToggleButton>
        <ToggleButton id="right">Right</ToggleButton>
      </ToggleButtonGroup>
      <ToggleButtonGroup id="size" aria-label="Size" orientation="vertical" selectionMode="multiple">
        <ToggleButton id="s">Small</ToggleButton>
        <ToggleButton id="m">Medium</ToggleButton>
        <ToggleButton id="l">Large</ToggleButton>
      </ToggleButtonGroup>
      <ToggleButtonGroup id="locked" aria-label="Locked" isDisabled defaultSelectedKeys={["on"]}>
        <ToggleButton id="on">On</ToggleButton>
        <ToggleButton id="off">Off</ToggleButton>
      </ToggleButtonGroup>
    </div>
  );
}
// #endregion
