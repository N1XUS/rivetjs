import { Icon } from "@rivetjs/kit/icon";
import { signal } from "@rivetjs/reactivity";
import { EmptyState } from "@rivetjs/ui/empty-state";
import { Kpi } from "@rivetjs/ui/kpi";
import { Rating } from "@rivetjs/ui/rating";
import { TrendChip } from "@rivetjs/ui/trend-chip";
import { ArrowUpRight, Heart, Inbox } from "lucide";

export const head = { title: "Section C" };

// UI-PORT S7 (Rivet additions, feature sets inspired by HeroUI Pro's public docs): TrendChip prefix / suffix / custom
// indicator, EmptyState structured parts, Rating with a heart icon and a render function, Kpi progress / actions.
export default function SectionCStory() {
  const score = signal(2);
  return (
    <main class="flex flex-col gap-6 bg-background p-6 text-foreground">
      <div class="flex gap-3">
        <TrendChip id="tc-default" trend="up">
          4%
        </TrendChip>
        <TrendChip id="tc-custom" trend="up" variant="primary" size="lg">
          <TrendChip.Prefix>+</TrendChip.Prefix>
          <TrendChip.Indicator>
            <Icon icon={ArrowUpRight} size={16} />
          </TrendChip.Indicator>
          8%
          <TrendChip.Suffix>vs last week</TrendChip.Suffix>
        </TrendChip>
      </div>
      <EmptyState id="es" variant="outline" class="w-96">
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <Icon icon={Inbox} size={24} />
          </EmptyState.Media>
          <EmptyState.Title>No messages</EmptyState.Title>
          <EmptyState.Description>New mail shows up here.</EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
      <EmptyState id="es-plain" />
      <Rating id="rt-heart" defaultValue={3} icon={Heart} aria-label="Hearts" />
      <div class="flex items-center gap-3">
        <Rating
          id="rt-render"
          value={score}
          maxValue={4}
          aria-label="Score"
          renderItem={(item) => <span data-on={item.isActive ? "" : undefined}>{item.value}</span>}
        />
        <span id="rt-score">{score()}</span>
      </div>
      <Kpi id="kpi" class="w-72">
        <Kpi.Header>
          <Kpi.Title>Storage</Kpi.Title>
        </Kpi.Header>
        <Kpi.Actions>
          <button type="button" id="kpi-more">
            More
          </button>
        </Kpi.Actions>
        <Kpi.Value value={64} />
        <Kpi.Progress value={64} status="warning" aria-label="Storage used" />
        <Kpi.Separator />
        <Kpi.Footer>36 GB left</Kpi.Footer>
      </Kpi>
    </main>
  );
}
