import { test } from "vitest";
import assert from "node:assert/strict";
import { renderToString } from "@rivetjs/runtime/testing/server";
import { Scheduler, type SchedulerEvent } from "../src/components/scheduler/index.ts";

const events: SchedulerEvent<{ owner: string }>[] = [{ id: "a", title: "Review", start: "2031-03-04T09:00", end: "2031-03-04T10:00", data: { owner: "Ada" } }];

test("scheduler SSR: typed CDK events, functional slots, default localized UI parts", async () => {
  const html = await renderToString(() => (
    <Scheduler
      defaultDate="2031-03-10"
      timeZone="UTC"
      locale="fr-FR"
      defaultEvents={events}
      class="custom-root"
      classNames={{ cell: "custom-cell", event: "custom-event", eventTitle: "custom-title" }}
    />
  ));
  assert.match(html, /data-slot="scheduler"/);
  assert.match(html, /scheduler[^"\n]*custom-root/);
  assert.match(html, /rv-SchedulerMonth-cell scheduler__cell custom-cell/);
  assert.match(html, /rv-SchedulerEvent scheduler__event custom-event/);
  assert.match(html, /rv-SchedulerEvent-title scheduler__event-title custom-title/);
  assert.match(html, /--rv-scheduler-visible-lanes:4/);
  assert.match(html, /class="button/);
  assert.match(html, /data-slot="segment"/);
  assert.match(html, /<svg/);
  assert.match(html, /Mois/);
  assert.match(html, /Semaine/);
  assert.doesNotMatch(html, />Month</);
});

test("scheduler SSR: toolbar false and custom header precedence", async () => {
  const hidden = await renderToString(() => <Scheduler defaultDate="2031-03-10" toolbar={false} />);
  assert.doesNotMatch(hidden, /scheduler__toolbar/);
  const custom = await renderToString(() => <Scheduler defaultDate="2031-03-10" toolbar={false} renderHeader={(api) => <h3>{api.title()}</h3>} />);
  assert.match(custom, /<h3/);
  assert.doesNotMatch(custom, /scheduler__toolbar/);
});

test("scheduler SSR: density lane defaults, explicit lane cap and custom event renderer", async () => {
  for (const [density, lanes] of [
    ["compact", 3],
    ["default", 4],
    ["comfortable", 5],
  ] as const) {
    const html = await renderToString(() => <Scheduler defaultDate="2031-03-10" density={density} visibleLanes="auto" />);
    assert.match(html, new RegExp(`--rv-scheduler-visible-lanes:${lanes}`));
  }
  const accessor = await renderToString(() => <Scheduler defaultDate="2031-03-10" density="comfortable" visibleLanes={() => "auto"} />);
  assert.match(accessor, /--rv-scheduler-visible-lanes:5/);
  const html = await renderToString(() => (
    <Scheduler defaultDate="2031-03-10" density="comfortable" visibleLanes={2} defaultEvents={events} renderEvent={(event) => <b>{event.data?.owner}</b>} />
  ));
  assert.match(html, /--rv-scheduler-visible-lanes:2/);
  assert.match(html, />Ada</);
});
