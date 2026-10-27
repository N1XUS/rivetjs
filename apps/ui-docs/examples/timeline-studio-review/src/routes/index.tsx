// Rivet-authored Timeline demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Timeline } from "@rivetjs/ui/timeline";
import { Avatar } from "@rivetjs/ui/avatar";
import { Chip } from "@rivetjs/ui/chip";

export const head = { title: "Timeline: Studio Review" };

// #region demo
const REVIEWS = [
  { who: "AM", name: "Ana Marques", action: "uploaded draft v3", when: "09:12", chip: null },
  { who: "JT", name: "Jon Tan", action: "requested changes", when: "10:40", chip: { label: "Changes", color: "warning" } },
  { who: "AM", name: "Ana Marques", action: "uploaded draft v4", when: "13:05", chip: null },
  { who: "LK", name: "Lea Klein", action: "approved", when: "15:30", chip: { label: "Approved", color: "success" } },
] as const;

export function StudioReview() {
  return (
    <Timeline id="timeline-review" aria-label="Review activity" class="w-full max-w-md" itemAlign="center">
      {REVIEWS.map((r) => (
        <Timeline.Item>
          <Timeline.Rail>
            <Timeline.Marker class="bg-transparent">
              <Avatar size="sm">
                <Avatar.Fallback>{r.who}</Avatar.Fallback>
              </Avatar>
            </Timeline.Marker>
            <Timeline.Connector />
          </Timeline.Rail>
          <Timeline.Content class="flex flex-wrap items-center gap-2">
            <span>
              <strong class="font-medium">{r.name}</strong> {r.action}
            </span>
            {r.chip ? (
              <Chip size="sm" variant="soft" color={r.chip.color}>
                {r.chip.label}
              </Chip>
            ) : null}
            <time class="ms-auto text-xs text-muted">{r.when}</time>
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
      <StudioReview />
    </div>
  );
}
