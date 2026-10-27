// Rivet-authored Timeline demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Timeline } from "@rivetjs/ui/timeline";

export const head = { title: "Timeline: Usage" };

// #region demo
const EVENTS = [
  { title: "Order placed", date: "2026-05-18", label: "May 18", detail: "Paid with Visa ending 4242.", status: "success" },
  { title: "Shipped", date: "2026-05-19", label: "May 19", detail: "Picked up by the courier in Lisbon.", status: "success" },
  { title: "Out for delivery", date: "2026-05-22", label: "May 22", detail: "Arrives today before 18:00.", status: "current" },
  { title: "Delivered", date: "2026-05-22", label: "Pending", detail: "Signature required.", status: "muted" },
] as const;

export function Basic() {
  return (
    <Timeline id="timeline-basic" aria-label="Order history" class="w-full max-w-sm">
      {EVENTS.map((event) => (
        <Timeline.Item status={event.status}>
          <Timeline.Content>
            <article class="flex flex-col gap-0.5">
              <h3 class="font-medium">{event.title}</h3>
              <time dateTime={event.date} class="text-xs text-muted">
                {event.label}
              </time>
              <p class="text-muted">{event.detail}</p>
            </article>
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
      <Basic />
    </div>
  );
}
