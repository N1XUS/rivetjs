// Rivet-authored Timeline demo (Rivet addition; feature set inspired by HeroUI Pro's public docs, own demo content).
import { Timeline } from "@rivetjs/ui/timeline";
import { Icon } from "@rivetjs/kit/icon";
import { GitCommitHorizontal, GitMerge, GitPullRequest, MessageSquare } from "lucide";

export const head = { title: "Timeline: Repository Activity" };

// #region demo
const ACTIVITY = [
  { icon: GitPullRequest, text: "opened pull request #482", sha: null, status: "default" },
  { icon: GitCommitHorizontal, text: "pushed 2 commits", sha: "a1c9e3f", status: "default" },
  { icon: MessageSquare, text: "left 3 review comments", sha: null, status: "default" },
  { icon: GitMerge, text: "merged into main", sha: "7d20b41", status: "success" },
] as const;

export function RepositoryActivity() {
  return (
    <Timeline id="timeline-repo" size="sm" aria-label="Pull request activity" class="w-full max-w-md">
      {ACTIVITY.map((a) => (
        <Timeline.Item status={a.status} align="center">
          <Timeline.Rail>
            <Timeline.Marker>
              <Icon icon={a.icon} />
            </Timeline.Marker>
            <Timeline.Connector />
          </Timeline.Rail>
          <Timeline.Content>
            <span class="font-medium">mira</span> {a.text}
            {a.sha ? <code class="ms-2 rounded bg-default px-1.5 py-0.5 text-xs">{a.sha}</code> : null}
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
      <RepositoryActivity />
    </div>
  );
}
