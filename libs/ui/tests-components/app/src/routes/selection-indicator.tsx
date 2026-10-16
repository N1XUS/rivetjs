// First selection change animates the indicator (UI-POLISH 2026-10-08): `#si-tabs` Tabs and `#si-seg` Segment on the
// resumed page (indicator server-rendered under the first item); `#si-mount` mounts the same pair under `#si-client`
// (client-created, `-c` ids).
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Segment } from "@rivetjs/ui/segment";
import { Tabs } from "@rivetjs/ui/tabs";

export default function SelectionIndicatorStories() {
  const mounted = signal(false);
  return (
    <section class="flex w-[560px] flex-col gap-8 p-10">
      <Tabs id="si-tabs" class="w-full">
        <Tabs.ListContainer>
          <Tabs.List aria-label="Options">
            <Tabs.Tab id="one">
              One
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="two">
              Two
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="three">
              Three
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      <Segment id="si-seg" aria-label="Range" defaultSelectedKey="day">
        <Segment.Item id="day">Day</Segment.Item>
        <Segment.Item id="week">Week</Segment.Item>
        <Segment.Item id="month">Month</Segment.Item>
      </Segment>
      <button id="si-mount" type="button" onClick={() => mounted.set(true)}>
        Mount
      </button>
      <div id="si-client">
        <Show when={mounted()}>
          {() => (
            <div class="flex flex-col gap-8">
              <Tabs id="si-tabs-c" class="w-full">
                <Tabs.ListContainer>
                  <Tabs.List aria-label="Client options">
                    <Tabs.Tab id="one">
                      One
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="two">
                      Two
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="three">
                      Three
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  </Tabs.List>
                </Tabs.ListContainer>
              </Tabs>
              <Segment id="si-seg-c" aria-label="Client range" defaultSelectedKey="day">
                <Segment.Item id="day">Day</Segment.Item>
                <Segment.Item id="week">Week</Segment.Item>
                <Segment.Item id="month">Month</Segment.Item>
              </Segment>
            </div>
          )}
        </Show>
      </div>
    </section>
  );
}
