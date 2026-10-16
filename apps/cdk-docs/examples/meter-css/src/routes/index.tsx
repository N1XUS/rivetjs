import { Meter } from "@rivetjs/cdk/meter";
import { Label } from "@rivetjs/cdk/label";

export const head = { title: "Meter with plain CSS" };

// #region demo
export default function CssMeter() {
  return (
    <div class="demo">
      {/* style render prop: a custom property the stylesheet reads. */}
      <Meter id="battery" value={35} style={({ percentage }) => ({ "--fill": percentage() + "%" })}>
        {({ valueText }) => (
          <>
            <Label>Battery</Label>
            <span class="value">{valueText()}</span>
            <div class="track">
              <div class="fill" />
            </div>
          </>
        )}
      </Meter>
      <Meter
        id="low"
        value={12}
        class={({ percentage }) => (percentage() < 20 ? "rv-Meter low" : "rv-Meter")}
        style={({ percentage }) => ({ "--fill": percentage() + "%" })}
      >
        {({ valueText }) => (
          <>
            <Label>Backup battery</Label>
            <span class="value">{valueText()}</span>
            <div class="track">
              <div class="fill" />
            </div>
          </>
        )}
      </Meter>
    </div>
  );
}
// #endregion
