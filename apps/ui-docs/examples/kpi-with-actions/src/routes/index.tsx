// Rivet-authored Kpi demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Icon } from "@rivetjs/kit/icon";
import { Kpi } from "@rivetjs/ui/kpi";
import { Button } from "@rivetjs/ui/button";
import { EllipsisVertical } from "lucide";

export const head = { title: "Kpi: with actions" };

// #region demo
export function WithActions() {
  return (
    <Kpi id="kpi-actions" class="w-full max-w-72">
      <Kpi.Header>
        <Kpi.Title>Active users</Kpi.Title>
      </Kpi.Header>
      <Kpi.Actions>
        <Button variant="ghost" size="sm" isIconOnly aria-label="More actions">
          <Icon icon={EllipsisVertical} size={16} />
        </Button>
      </Kpi.Actions>
      <Kpi.Content>
        <Kpi.Value value={12840} />
        <Kpi.Trend trend="up">6.2%</Kpi.Trend>
      </Kpi.Content>
      <Kpi.Description>Last 30 days</Kpi.Description>
    </Kpi>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <WithActions />
    </div>
  );
}
