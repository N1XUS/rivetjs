// Rivet-authored Kpi demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Kpi } from "@rivetjs/ui/kpi";
import { CircleCheck, Clock, TriangleAlert } from "lucide";

export const head = { title: "Kpi: with icon" };

// #region demo
export function WithIcon() {
  return (
    <div id="kpi-icons" class="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
      <Kpi>
        <Kpi.Header>
          <Kpi.Icon status="success">
            <Icon icon={CircleCheck} size={16} />
          </Kpi.Icon>
          <Kpi.Title>Uptime</Kpi.Title>
        </Kpi.Header>
        <Kpi.Value value={0.9996} formatOptions={{ style: "percent", maximumFractionDigits: 2 }} />
      </Kpi>
      <Kpi>
        <Kpi.Header>
          <Kpi.Icon status="warning">
            <Icon icon={Clock} size={16} />
          </Kpi.Icon>
          <Kpi.Title>Queue time</Kpi.Title>
        </Kpi.Header>
        <Kpi.Value>4m 12s</Kpi.Value>
      </Kpi>
      <Kpi>
        <Kpi.Header>
          <Kpi.Icon status="danger">
            <Icon icon={TriangleAlert} size={16} />
          </Kpi.Icon>
          <Kpi.Title>Failed jobs</Kpi.Title>
        </Kpi.Header>
        <Kpi.Value value={17} />
      </Kpi>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithIcon />
    </div>
  );
}
