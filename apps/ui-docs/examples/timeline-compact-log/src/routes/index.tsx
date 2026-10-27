// Rivet-authored Timeline demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Timeline } from "@rivetjs/ui/timeline";

export const head = { title: "Timeline: Compact Log" };

// #region demo
const LOG = [
  { time: "12:00:04", text: "Deploy started", status: "default" },
  { time: "12:00:31", text: "Build finished (27 s)", status: "success" },
  { time: "12:01:02", text: "Health check slow: 2.1 s", status: "warning" },
  { time: "12:01:15", text: "Traffic switched to the new release", status: "success" },
  { time: "12:03:40", text: "Old release drained", status: "muted" },
] as const;

export function CompactLog() {
  return (
    <Timeline id="timeline-log" size="sm" density="compact" aria-label="Deploy log" class="w-full max-w-md font-mono">
      {LOG.map((line) => (
        <Timeline.Item status={line.status}>
          <Timeline.Content class="flex gap-3">
            <time class="text-muted">{line.time}</time>
            <span>{line.text}</span>
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
      <CompactLog />
    </div>
  );
}
