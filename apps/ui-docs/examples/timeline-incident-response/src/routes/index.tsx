// Rivet-authored Timeline demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Timeline } from "@rivetjs/ui/timeline";
import { Icon } from "@rivetjs/kit/icon";
import { CircleAlert, CircleCheck, Search, Wrench } from "lucide";

export const head = { title: "Timeline: Incident Response" };

// #region demo
const STEPS = [
  { icon: CircleAlert, status: "danger", title: "Elevated error rate", time: "14:02", text: "Checkout API returns 5xx for 12 % of requests." },
  { icon: Search, status: "warning", title: "Investigating", time: "14:09", text: "A configuration change narrowed the connection pool." },
  { icon: Wrench, status: "warning", title: "Fix deployed", time: "14:31", text: "Pool size restored; error rate falling." },
  { icon: CircleCheck, status: "success", title: "Resolved", time: "14:50", text: "All systems normal. Post-mortem on Friday." },
] as const;

export function IncidentResponse() {
  return (
    <Timeline id="timeline-incident" aria-label="Incident timeline" class="w-full max-w-md">
      {STEPS.map((s) => (
        <Timeline.Item status={s.status}>
          <Timeline.Rail>
            <Timeline.Marker>
              <Icon icon={s.icon} />
            </Timeline.Marker>
            <Timeline.Connector />
          </Timeline.Rail>
          <Timeline.Content>
            <div class="flex items-baseline justify-between gap-3">
              <h3 class="font-medium">{s.title}</h3>
              <time class="text-xs text-muted">{s.time}</time>
            </div>
            <p class="text-muted">{s.text}</p>
          </Timeline.Content>
        </Timeline.Item>
      ))}
    </Timeline>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <IncidentResponse />
    </div>
  );
}
