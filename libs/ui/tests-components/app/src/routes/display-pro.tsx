// Rivet additions on a resumed page (feature sets inspired by HeroUI Pro's public docs): `#kg` KpiGroup (2 cards +
// separator), `#nv` NumberValue, `#wg` Widget, `#icg` ItemCardGroup list (3 rows, the 2nd a link), `#icg-grid` grid,
// `#tl` Timeline (default rails, the last item forced connector off), `#tl-own` item with its own rail + icon marker,
// `#tl-center` centred alternate timeline.
import { Kpi } from "@rivetjs/ui/kpi";
import { KpiGroup } from "@rivetjs/ui/kpi-group";
import { NumberValue } from "@rivetjs/ui/number-value";
import { Widget } from "@rivetjs/ui/widget";
import { ItemCard } from "@rivetjs/ui/item-card";
import { ItemCardGroup } from "@rivetjs/ui/item-card-group";
import { Timeline } from "@rivetjs/ui/timeline";

export default function DisplayPro() {
  return (
    <main class="flex flex-col gap-8 bg-background p-6 text-foreground">
      <KpiGroup id="kg" class="w-full max-w-2xl">
        <Kpi>
          <Kpi.Title>Revenue</Kpi.Title>
          <Kpi.Value value={48210} />
        </Kpi>
        <KpiGroup.Separator />
        <Kpi>
          <Kpi.Title>Orders</Kpi.Title>
          <Kpi.Value value={1284} />
        </Kpi>
      </KpiGroup>
      <p id="nv" class="text-2xl">
        <NumberValue value={1520000} notation="compact" prefix="~" suffix="users" />
      </p>
      <Widget id="wg" class="w-full max-w-md">
        <Widget.Header>
          <Widget.Title>Sessions</Widget.Title>
          <Widget.Legend>
            <Widget.LegendItem color="rgb(255, 0, 0)">Web</Widget.LegendItem>
          </Widget.Legend>
        </Widget.Header>
        <Widget.Content>content</Widget.Content>
      </Widget>
      <ItemCardGroup id="icg" aria-label="Settings" class="w-full max-w-md">
        <ItemCard>
          <ItemCard.Content>
            <ItemCard.Title>Account</ItemCard.Title>
          </ItemCard.Content>
        </ItemCard>
        <ItemCard render={(props) => <a href="#privacy" {...props} />}>
          <ItemCard.Content>
            <ItemCard.Title>Privacy</ItemCard.Title>
          </ItemCard.Content>
        </ItemCard>
        <ItemCard>
          <ItemCard.Content>
            <ItemCard.Title>Billing</ItemCard.Title>
          </ItemCard.Content>
        </ItemCard>
      </ItemCardGroup>
      <ItemCardGroup id="icg-grid" layout="grid" columns={3} aria-label="Grid" class="w-full max-w-3xl">
        <ItemCard>a</ItemCard>
        <ItemCard>b</ItemCard>
        <ItemCard>c</ItemCard>
      </ItemCardGroup>
      <Timeline id="tl" aria-label="History" class="w-full max-w-md">
        <Timeline.Item status="success">
          <Timeline.Content>One</Timeline.Content>
        </Timeline.Item>
        <Timeline.Item id="tl-own" status="current">
          <Timeline.Rail>
            <Timeline.Marker>2</Timeline.Marker>
            <Timeline.Connector />
          </Timeline.Rail>
          <Timeline.Content>Two</Timeline.Content>
        </Timeline.Item>
        <Timeline.Item>
          <Timeline.Content>Three</Timeline.Content>
        </Timeline.Item>
      </Timeline>
      <Timeline id="tl-center" axis="center" placement="alternate" aria-label="Milestones" class="w-full max-w-xl">
        <Timeline.Item>
          <Timeline.Content>First</Timeline.Content>
        </Timeline.Item>
        <Timeline.Item>
          <Timeline.Content>Second</Timeline.Content>
        </Timeline.Item>
        <Timeline.Item side="end">
          <Timeline.Content>Third</Timeline.Content>
        </Timeline.Item>
        <Timeline.Item>
          <Timeline.Content side="end">Fourth</Timeline.Content>
        </Timeline.Item>
      </Timeline>
    </main>
  );
}
