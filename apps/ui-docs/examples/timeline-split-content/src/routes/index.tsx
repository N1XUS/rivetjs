// Rivet-authored Timeline demo (Rivet addition; feature set scoped from public docs of commercial UI kits, own demo content).
import { Timeline } from "@rivetjs/ui/timeline";

export const head = { title: "Timeline: Split Content" };

// #region demo
const TRIP = [
  { date: "Mon 6", title: "Arrive in Porto", text: "Check in at 15:00." },
  { date: "Tue 7", title: "Douro valley", text: "Boat tour, lunch at the quinta." },
  { date: "Thu 9", title: "Train to Lisbon", text: "Alfa Pendular, 2 h 50." },
];

export function SplitContent() {
  return (
    <Timeline id="timeline-split" axis="center" aria-label="Itinerary" class="w-full max-w-xl">
      {TRIP.map((day) => (
        <Timeline.Item>
          <Timeline.Content side="start">
            <time class="text-sm font-medium text-muted">{day.date}</time>
          </Timeline.Content>
          <Timeline.Content side="end">
            <h3 class="font-medium">{day.title}</h3>
            <p class="text-sm text-muted">{day.text}</p>
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
      <SplitContent />
    </div>
  );
}
