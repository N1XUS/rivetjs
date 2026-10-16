import { signal } from "@rivetjs/reactivity";
import { Meter } from "@rivetjs/cdk/meter";

export const head = { title: "Meter DOM events and attributes" };

// #region demo
export default function MeterEvents() {
  const log = signal("none");
  return (
    <div class="m-4 grid max-w-xs gap-2 text-sm">
      <Meter
        id="cpu"
        value={41}
        aria-label="CPU"
        lang="de-DE"
        data-source="host-1"
        class="rounded border p-2"
        onPointerEnter={() => log.set("pointerenter")}
        onDblClick={() => log.set("dblclick")}
      >
        {({ valueText }) => <span>CPU {valueText()}</span>}
      </Meter>
      <output id="cpu-log">Last event: {log()}</output>
    </div>
  );
}
// #endregion
