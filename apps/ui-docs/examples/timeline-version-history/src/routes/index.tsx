// Rivet-authored Timeline demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Timeline } from "@rivetjs/ui/timeline";
import { Chip } from "@rivetjs/ui/chip";

export const head = { title: "Timeline: Version History" };

// #region demo
const RELEASES = [
  { version: "2.4.0", date: "2026-10-20", changes: ["Timeline component", "Faster first paint"] },
  { version: "2.3.1", date: "2026-10-02", changes: ["Fix: tooltip position in RTL"] },
  { version: "2.3.0", date: "2026-09-14", changes: ["Number value formatting", "New chart tooltip"] },
];

export function VersionHistory() {
  return (
    <Timeline id="timeline-versions" aria-label="Release history" class="w-full max-w-md">
      {RELEASES.map((r, i) => (
        <Timeline.Item status={i === 0 ? "current" : "default"}>
          <Timeline.Content class="flex flex-col gap-1.5">
            <div class="flex items-center gap-2">
              <Chip size="sm" variant={i === 0 ? "primary" : "soft"} color={i === 0 ? "accent" : "default"}>
                v{r.version}
              </Chip>
              <time dateTime={r.date} class="text-xs text-muted">
                {r.date}
              </time>
            </div>
            <ul class="list-disc ps-5 text-muted">
              {r.changes.map((c) => (
                <li>{c}</li>
              ))}
            </ul>
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
      <VersionHistory />
    </div>
  );
}
