import { ProgressBar } from "@rivetjs/cdk/progress-bar";
import { Label } from "@rivetjs/cdk/label";

export const head = { title: "ProgressBar with plain CSS" };

// #region demo
export default function CssProgress() {
  return (
    <div class="demo">
      <ProgressBar id="css-copy" value={45} style={({ percentage }) => ({ "--fill": (percentage() ?? 0) + "%" })}>
        {({ valueText }) => (
          <>
            <Label>Copying</Label>
            <span class="value">{valueText()}</span>
            <div class="track">
              <div class="fill" />
            </div>
          </>
        )}
      </ProgressBar>
      <ProgressBar id="css-wait" isIndeterminate>
        <Label>Waiting for server</Label>
        <div class="track">
          <div class="fill" />
        </div>
      </ProgressBar>
    </div>
  );
}
// #endregion
