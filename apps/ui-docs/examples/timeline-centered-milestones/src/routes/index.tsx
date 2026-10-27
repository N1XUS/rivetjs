// Rivet-authored Timeline demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Timeline } from "@rivetjs/ui/timeline";
import { Icon } from "@rivetjs/kit/icon";
import { Flag, Rocket, Sparkles, Users } from "lucide";

export const head = { title: "Timeline: Centered Milestones" };

// #region demo
const MILESTONES = [
  { icon: Flag, title: "Kick-off", when: "Q1 2025", text: "Team of three, first prototype." },
  { icon: Users, title: "First 1,000 users", when: "Q3 2025", text: "Public beta opens." },
  { icon: Rocket, title: "1.0 launch", when: "Q1 2026", text: "Stable API, docs site." },
  { icon: Sparkles, title: "Next", when: "Q4 2026", text: "Plugins and themes." },
];

export function CenteredMilestones() {
  return (
    <Timeline id="timeline-centered" axis="center" placement="alternate" size="lg" aria-label="Milestones" class="w-full max-w-2xl">
      {MILESTONES.map((m, i) => (
        <Timeline.Item status={i === MILESTONES.length - 1 ? "current" : "default"}>
          <Timeline.Rail>
            <Timeline.Marker>
              <Icon icon={m.icon} />
            </Timeline.Marker>
            <Timeline.Connector />
          </Timeline.Rail>
          <Timeline.Content>
            <p class="text-xs text-muted">{m.when}</p>
            <h3 class="font-medium">{m.title}</h3>
            <p class="text-sm text-muted">{m.text}</p>
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
      <CenteredMilestones />
    </div>
  );
}
