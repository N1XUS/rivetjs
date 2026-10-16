import { Switch } from "@rivetjs/cdk/switch";

export const head = { title: "Switch with plain CSS" };

// #region demo
export default function CssSwitch() {
  return (
    <div class="demo">
      {/* No class prop: the label keeps rv-Switch. */}
      <Switch id="css-sw">
        <span class="track" aria-hidden="true" />
        Auto-update
      </Switch>
      <Switch id="css-beta" isDisabled>
        <span class="track" aria-hidden="true" />
        Beta channel
      </Switch>
    </div>
  );
}
// #endregion
